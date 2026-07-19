import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures/nested-suspense', import.meta.url))

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

function consoleLogsFor (page: Page) {
  // @ts-expect-error untyped
  return page._consoleLogs as Array<{ type: string, text: string }>
}

function filteredLogs (page: Page) {
  return consoleLogsFor(page).map(l => l.text).filter(i =>
    !i.includes('[vite]')
    && !i.includes('<Suspense> is an experimental feature')
    // webpack dev client noise (HMR status logs and echoed build-warning groups)
    && !i.includes('[HMR]')
    && !i.startsWith('%c')
    && i !== 'console.groupEnd',
  )
}

// Bug #7337
test.describe('deferred app suspense resolve', () => {
  for (const path of ['/async-parent/child', '/internal-layout/async-parent/child']) {
    test(`should wait for all suspense instance on initial hydration (${path})`, async ({ page, goto }) => {
      await goto(path)

      await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)
      // Wait for all pending micro ticks to be cleared in case hydration hasn't finished yet.
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

      const hydrationLogs = consoleLogsFor(page).filter(log => log.text.includes('isHydrating'))
      expect(hydrationLogs.length).toBe(3)
      expect(hydrationLogs.every(log => log.text === 'isHydrating: true')).toBe(true)
    })
  }

  test('should wait for suspense in parent layout', async ({ page, goto }) => {
    await goto('/hydration/layout')
    await page.getByText('Tests whether hydration is properly resolved within an async layout').waitFor()
  })

  test('should fully hydrate even if there is a redirection on a page with `ssr: false`', async ({ page, goto }) => {
    await goto('/hydration/spa-redirection/start')
    await page.getByText('fully hydrated and ready to go').waitFor()
  })
})

test.describe('nested suspense', () => {
  const navigations = ([
    ['/suspense/sync-1/async-1/', '/suspense/sync-2/async-1/'],
    ['/suspense/sync-1/sync-1/', '/suspense/sync-2/async-1/'],
    ['/suspense/async-1/async-1/', '/suspense/async-2/async-1/'],
    ['/suspense/async-1/sync-1/', '/suspense/async-2/async-1/'],
  ] as const).flatMap(([start, end]) => [
    [start, end],
    [start, end + '?layout=custom'],
    [start + '?layout=custom', end],
  ])

  for (const [start, nav] of navigations) {
    test(`should navigate from ${start} to ${nav} with no white flash`, async ({ page, goto }) => {
      await goto(start!)

      const slug = nav!.replace(/\?.*$/, '').replace(/[/-]+/g, '-')
      await page.click(`[href^="${nav}"]`)

      const text = await page.waitForFunction(slug => document.querySelector(`main:has(#child${slug})`)?.innerHTML, slug)
        .then(r => r.evaluate(r => r))

      expect(text).toContain('Async child: 2 - 1')
      expect(text).toContain('parent: 2')

      const first = start!.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\/(?<childType>a?sync)-(?<childNum>\d)\//)!.groups!
      const last = nav!.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\/(?<childType>a?sync)-(?<childNum>\d)\//)!.groups!

      expect(filteredLogs(page).sort()).toEqual([
        // [first load] from parent
        `[${first.parentType}]`,
        ...first.parentType === 'async' ? ['[async] running async data'] : [],
        // [first load] from child
        `[${first.parentType}] [${first.childType}]`,
        ...first.childType === 'async' ? [`[${first.parentType}] [${first.parentNum}] [async] [${first.childNum}] running async data`] : [],
        // [navigation] from parent
        `[${last.parentType}]`,
        ...last.parentType === 'async' ? ['[async] running async data'] : [],
        // [navigation] from child
        `[${last.parentType}] [${last.childType}]`,
        ...last.childType === 'async' ? [`[${last.parentType}] [${last.parentNum}] [async] [${last.childNum}] running async data`] : [],
      ].sort())
    })
  }

  const outwardNavigations = [
    ['/suspense/async-2/async-1/', '/suspense/async-1/'],
    ['/suspense/async-2/sync-1/', '/suspense/async-1/'],
  ]

  for (const [start, nav] of outwardNavigations) {
    test(`should navigate from ${start} to a parent ${nav} with no white flash`, async ({ page, goto }) => {
      await goto(start!)

      await page.waitForSelector(`main:has(#child${start!.replace(/[/-]+/g, '-')})`)

      const slug = start!.replace(/[/-]+/g, '-')
      await page.click(`[href^="${nav}"]`)

      // wait until child selector disappears and grab HTML of parent
      const text = await page.waitForFunction(slug => document.querySelector(`main:not(:has(#child${slug}))`)?.innerHTML, slug)
        .then(r => r.evaluate(r => r))

      expect(text).toContain('Async parent: 1')

      const first = start!.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\/(?<childType>a?sync)-(?<childNum>\d)\//)!.groups!
      const last = nav!.match(/\/suspense\/(?<parentType>a?sync)-\d\//)!.groups!

      await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, nav)

      expect(filteredLogs(page).sort()).toEqual([
        // [first load] from parent
        `[${first.parentType}]`,
        ...first.parentType === 'async' ? ['[async] running async data'] : [],
        // [first load] from child
        `[${first.parentType}] [${first.childType}]`,
        ...first.childType === 'async' ? [`[${first.parentType}] [${first.parentNum}] [async] [${first.childNum}] running async data`] : [],
        // [navigation] from parent
        `[${last.parentType}]`,
        ...last.parentType === 'async' ? ['[async] running async data'] : [],
      ].sort())
    })
  }

  const inwardNavigations = [
    ['/suspense/async-2/', '/suspense/async-1/async-1/'],
    ['/suspense/async-2/', '/suspense/async-1/sync-1/'],
  ]

  for (const [start, nav] of inwardNavigations) {
    test(`should navigate from ${start} to a child ${nav} with no white flash`, async ({ page, goto }) => {
      await goto(start!)

      const slug = nav!.replace(/[/-]+/g, '-')
      await page.click(`[href^="${nav}"]`)

      // wait until child selector appears and grab HTML of parent
      const text = await page.waitForFunction(slug => document.querySelector(`main:has(#child${slug})`)?.innerHTML, slug)
        .then(r => r.evaluate(r => r))

      expect(text).toContain('Async parent: 1')

      const first = start!.match(/\/suspense\/(?<parentType>a?sync)-\d\//)!.groups!
      const last = nav!.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\/(?<childType>a?sync)-(?<childNum>\d)\//)!.groups!

      expect(filteredLogs(page).sort()).toEqual([
        // [first load] from parent
        `[${first.parentType}]`,
        ...first.parentType === 'async' ? ['[async] running async data'] : [],
        // [navigation] from parent
        `[${last.parentType}]`,
        ...last.parentType === 'async' ? ['[async] running async data'] : [],
        // [navigation] from child
        `[${last.parentType}] [${last.childType}]`,
        ...last.childType === 'async' ? [`[${last.parentType}] [${last.parentNum}] [async] [${last.childNum}] running async data`] : [],
      ].sort())
    })
  }
})

test.describe('route provider', () => {
  test('should preserve current route when navigation is suspended', async ({ page, goto }) => {
    await goto('/route-provider/foo')
    await page.click('[href="/route-provider/bar"]')
    await expect(page.getByTestId('foo')).toHaveText('foo: /route-provider/foo - /route-provider/foo')
    await expect(page.getByTestId('bar')).toHaveText('bar: /route-provider/bar - /route-provider/bar')
  })
})
