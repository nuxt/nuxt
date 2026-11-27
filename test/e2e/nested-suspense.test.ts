import type { Page } from '@playwright/test'
import { consoleLogs, expect, fixtureDir, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir('nested-suspense'),
  },
})

function filteredLogs (page: Page) {
  return consoleLogs(page).map(l => l.text).filter(i => !i.includes('[vite]') && !i.includes('<Suspense> is an experimental feature'))
}

// Bug #7337
test.describe('deferred app suspense resolve', () => {
  for (const path of ['/async-parent/child', '/internal-layout/async-parent/child']) {
    test(`should wait for all suspense instance on initial hydration (${path})`, async ({ page, goto }) => {
      await goto(path)

      await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)
      // Wait for all pending micro ticks to be cleared in case hydration hasn't finished yet.
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

      const hydrationLogs = consoleLogs(page).filter(log => log.text.includes('isHydrating'))
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

test.describe('boot', () => {
  test('should start app creation and mount in new tasks', async ({ page, goto }) => {
    await goto('/route-provider/foo')
    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)
    expect(await page.evaluate(() => (window as Window & { __bootTasks?: Record<string, boolean> }).__bootTasks)).toEqual({
      createdAfterModuleTask: true,
      beforeMountAfterPluginTask: true,
    })
  })
})

// https://github.com/nuxt/nuxt/issues/34683, https://github.com/nuxt/nuxt/issues/28425
test.describe('navigation with a layout change', () => {
  test('completes when a redirect crosses the layout boundary', async ({ page, goto }) => {
    await goto('/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('alternate-layout')).toBeVisible()

    await page.getByTestId('link-redirect').click()

    await expect(page.getByTestId('target-content')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('default-layout')).toBeVisible()
    await expect(page.getByTestId('index-title')).not.toBeVisible()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('settles on the final route after rapid navigation across useAsyncData pages', async ({ page, goto }) => {
    await goto('/asyncdata/p0')
    await expect(page.getByTestId('asyncdata-p0')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('default-layout')).toBeVisible()

    await page.getByTestId('link-async-p1').dispatchEvent('click')
    await page.getByTestId('link-async-p2').dispatchEvent('click')
    await page.getByTestId('link-async-p3').dispatchEvent('click')

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/asyncdata/p3')
    await expect(page.getByTestId('asyncdata-p3')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('default-layout')).toBeVisible()

    expect(page).toHaveNoErrorsOrWarnings()
  })
})

test.describe('route provider', () => {
  test('should preserve current route when navigation is suspended', async ({ page, goto }) => {
    await goto('/route-provider/foo')
    await page.click('[href="/route-provider/bar"]')
    await expect(page.getByTestId('foo')).toHaveText('foo: /route-provider/foo - /route-provider/foo')
    await expect(page.getByTestId('bar')).toHaveText('bar: /route-provider/bar - /route-provider/bar')
  })
})
