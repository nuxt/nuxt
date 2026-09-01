import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import type { Page } from '@playwright/test'
import type { Router } from 'vue-router'
import { expect, test } from './test-utils'

/**
 * Navigating while the initial hydration is still suspended (for example
 * pressing the browser back button before a slow page finishes hydrating)
 * must interrupt hydration and render the target route immediately, instead
 * of updating the URL while the DOM stays stuck on the old SSR content.
 *
 * The underlying fix lives in the patched `@vue/runtime-core`
 * (the `@vue/runtime-core` patch in `patches/`): a nested suspensible
 * `<Suspense>` used to silently drop patches while the root suspense was
 * still unresolved, which is always the case during hydration.
 */

const fixtureDir = fileURLToPath(new URL('../fixtures/hydration-navigation', import.meta.url))

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

/**
 * Seed a same-document history entry for `/` behind the entry being loaded,
 * mirroring vue-router's own history state, so the browser back button
 * triggers a same-document popstate during initial hydration - the same
 * situation as a user pressing back right after a client-side navigation
 * created those entries.
 */
function seedHistoryEntries (page: Page, path: string) {
  return page.addInitScript((current) => {
    if (location.pathname === current && !(history.state && history.state.current)) {
      history.replaceState({ back: null, current: '/', forward: current, position: 0, replaced: true, scroll: null }, '', '/')
      history.pushState({ back: '/', current, forward: null, position: 1, replaced: false, scroll: null }, '', current)
    }
  }, path)
}

async function gotoMidHydration (page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  // the app has booted (`$router` means the router plugin has run), but
  // hydration is suspended by <HydrationBlocker>
  await page.waitForFunction(() => !!window.useNuxtApp?.().$router && window.useNuxtApp?.().isHydrating === true)
}

test.describe('navigation during initial hydration', () => {
  test('browser back before hydration completes renders the previous page', async ({ page }) => {
    await seedHistoryEntries(page, '/slow')
    await gotoMidHydration(page, '/slow')
    await expect(page.getByTestId('slow-title')).toBeVisible()

    await page.goBack()

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()
    await expect(page.getByTestId('hydration-blocker')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)

    // hydration finishes without waiting for the abandoned page
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    // resolving the abandoned async setup must not resurrect the old page
    await page.evaluate(() => window.__releaseHydration?.())
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('browser back before hydration completes swaps the layout', async ({ page }) => {
    await seedHistoryEntries(page, '/slow-other-layout')
    await gotoMidHydration(page, '/slow-other-layout')
    await expect(page.getByTestId('other-layout')).toBeVisible()

    await page.goBack()

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)
    await expect(page.getByTestId('other-layout')).not.toBeAttached()
    await expect(page.getByTestId('slow-other-title')).not.toBeAttached()

    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    // resolving the abandoned async setup must not resurrect the old page
    await page.evaluate(() => window.__releaseHydration?.())
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-other-title')).not.toBeAttached()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('browser back while the page component itself is suspended leaves no stale DOM', async ({ page }) => {
    // like a page with top-level `await useAsyncData()`: the interrupted
    // branch's root is an async component that never rendered
    await seedHistoryEntries(page, '/slow-inline')
    await gotoMidHydration(page, '/slow-inline')
    await expect(page.getByTestId('slow-inline-title')).toBeVisible()

    await page.goBack()

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-inline-title')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)

    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    await page.evaluate(() => window.__releaseHydration?.())
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-inline-title')).not.toBeAttached()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('a navigation started during boot survives the initial route replace', async ({ page }) => {
    // `?bootgate` holds a plugin open, so the app has a live router but has not
    // reached `app:created` yet. A navigation started in that window must not
    // be cancelled by the initial forced `router.replace` that runs there.
    await page.goto('/slow?bootgate', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => typeof window.__releaseBoot === 'function')

    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/') })
    await page.evaluate(() => window.__releaseBoot?.())

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('a navigation that finishes during boot does not corrupt the first render', async ({ page }) => {
    // same held boot window, but this time the navigation *completes* before
    // the app mounts, so `<NuxtPage>`'s first render sees `/` while the SSR
    // DOM on the page is still `/slow`: it has to hydrate against the route it
    // was rendered with and swap afterwards, or it claims the wrong nodes
    await page.goto('/slow?bootgate', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => typeof window.__releaseBoot === 'function')

    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/') })
    await page.waitForFunction(() => (window.useNuxtApp?.().$router as Router).currentRoute.value.path === '/')
    await page.evaluate(() => window.__releaseBoot?.())

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()
    await expect(page.getByTestId('hydration-blocker')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('programmatic navigation before hydration completes renders the target page', async ({ page }) => {
    await gotoMidHydration(page, '/slow')

    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/') })

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)

    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('navigation to an async page keeps the old view until it resolves', async ({ page }) => {
    await gotoMidHydration(page, '/slow')

    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/async-target') })
    await page.waitForFunction(() => location.pathname === '/async-target')

    // the target page is still suspended: the old SSR content stays visible
    await expect(page.getByTestId('slow-title')).toBeVisible()
    await expect(page.getByTestId('async-target-title')).not.toBeAttached()

    await page.evaluate(() => window.__releaseTarget?.())

    await expect(page.getByTestId('async-target-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('second navigation while the first async target is still pending', async ({ page }) => {
    await gotoMidHydration(page, '/slow')

    // first navigation pends on the async target, so the page suspense is no
    // longer hydrating but the root suspense still is
    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/async-target') })
    await page.waitForFunction(() => location.pathname === '/async-target')
    await expect(page.getByTestId('slow-title')).toBeVisible()

    // the second navigation must still be applied
    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/') })

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    // resolving the abandoned async target must not resurrect it
    await page.evaluate(() => window.__releaseTarget?.())
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('async-target-title')).not.toBeAttached()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('second navigation after a pending cross-layout target', async ({ page }) => {
    await gotoMidHydration(page, '/slow')

    // first navigation pends on an async page in another layout
    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/async-target-other') })
    await page.waitForFunction(() => location.pathname === '/async-target-other')
    await expect(page.getByTestId('slow-title')).toBeVisible()

    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/') })

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)
    await expect(page.getByTestId('other-layout')).not.toBeAttached()
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    await page.evaluate(() => window.__releaseTarget?.())
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('async-target-other-title')).not.toBeAttached()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('forward after an interrupted hydration renders the slow page cleanly', async ({ page }) => {
    await seedHistoryEntries(page, '/slow')
    await gotoMidHydration(page, '/slow')

    await page.goBack()
    await expect(page.getByTestId('index-title')).toBeVisible()

    await page.goForward()
    await page.waitForFunction(() => location.pathname === '/slow')
    // the slow page suspends again on client-side navigation; the index page
    // stays visible until it resolves
    await expect(page.getByTestId('index-title')).toBeVisible()

    await page.evaluate(() => window.__releaseHydration?.())

    await expect(page.getByTestId('slow-title')).toBeVisible()
    await expect(page.getByTestId('index-title')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)

    expect(page).toHaveNoErrorsOrWarnings()
  })
})

declare global {
  interface Window {
    __releaseBoot?: () => void
    __releaseHydration?: () => void
    __releaseTarget?: () => void
  }
}
