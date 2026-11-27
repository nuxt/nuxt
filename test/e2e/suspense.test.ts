import type { Page } from '@playwright/test'
import { expect, fixtureDir, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir('suspense'),
  },
})

function waitForPath (page: Page, path: string, timeout?: number) {
  return page.waitForFunction(path => window.useNuxtApp?.()._route.path === path, path, { timeout })
}

test.describe('Suspense multiple navigation', () => {
  test('should not throw error during multiple rapid navigation', async ({ page, goto }) => {
    await goto('/')
    await expect(page.getByTestId('btn-a')).toHaveText(' Target A ')

    await page.getByTestId('btn-a').click()
    await waitForPath(page, '/target')
    await expect(page.getByTestId('content')).toContainText('Hello a')

    await page.goBack()
    await waitForPath(page, '/')
    await expect(page.getByTestId('index-title')).toBeVisible()

    await page.evaluate(() => {
      for (let i = 0; i < 4; i++) {
        for (const testId of ['btn-a', 'btn-b']) {
          document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        }
      }
    })

    await waitForPath(page, '/target', 10_000)
    await expect(page.getByTestId('content')).toContainText('Hello b', { timeout: 10_000 })

    expect(page).toHaveNoErrorsOrWarnings()
  })

  // https://github.com/nuxt/nuxt/issues/23232
  // the inner <NuxtPage> caches a Suspense vnode whose boundary has already been unmounted,
  // with a root <NuxtPage> rendering Suspense, KeepAlive or Transition
  for (const variant of [
    { name: 'plain', query: '' },
    { name: 'with keepalive', query: '?ka=1' },
    { name: 'with transition', query: '?tr=1' },
  ] as const) {
    test(`should not throw when navigating from a deeply nested route to an async page (${variant.name})`, async ({ page, goto }) => {
      await goto(`/${variant.query}`)
      await expect(page.getByTestId('index-title')).toBeVisible()

      for (const [link, path, title] of [
        ['link-project', '/setting/project', 'project-title'],
        ['link-create', '/setting/project/create', 'create-title'],
        ['link-back-project', '/setting/project', 'project-title'],
        ['nav-link-waiting', '/waiting', 'waiting-title'],
      ] as const) {
        await page.getByTestId(link).click()
        await waitForPath(page, path)
        await expect(page.getByTestId(title)).toBeVisible()
      }

      expect(page).toHaveNoErrorsOrWarnings()
    })
  }
})

test.describe('Client-only components during hydration', () => {
  test('should render a client-only component whose props change before it mounts', async ({ page, goto }) => {
    await goto('/client-rerender')
    await expect(page.getByTestId('client-count')).toHaveText('count: 1')

    expect(page).toHaveNoErrorsOrWarnings()
  })
})
