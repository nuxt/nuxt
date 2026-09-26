import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import type { Page } from '@playwright/test'
import type { Router } from 'vue-router'
import { NavigationFailureType } from 'vue-router'
import { expect, test } from './test-utils'

// Browser back navigation must replace the SSR branch even while root hydration is pending.
// Updating only the URL would leave the user on the abandoned page until its async work finishes.

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
    if (location.pathname === current && !history.state?.current) {
      history.replaceState({ back: null, current: '/', forward: current, position: 0, replaced: true, scroll: null }, '', '/')
      history.pushState({ back: '/', current, forward: null, position: 1, replaced: false, scroll: null }, '', current)
    }
  }, path)
}

async function gotoMidHydration (page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  // the app has booted (`$router` means the router plugin has run), but
  // hydration is suspended on the `__releaseHydration` test gate
  await page.waitForFunction(() =>
    !!window.useNuxtApp?.().$router &&
    window.useNuxtApp?.().isHydrating === true &&
    typeof window.__releaseHydration === 'function',
  )
}

async function startBootNavigation (page: Page, to: string, outcome: 'success' | 'abort' | 'throw' = 'success') {
  await page.evaluate(async ({ to, outcome }) => {
    const nuxtApp = window.useNuxtApp!()
    const router = nuxtApp.$router as Router
    const initialPath = router.currentRoute.value.fullPath
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const started = new Promise<void>((resolve) => {
      router.beforeEach(async (target) => {
        if (target.fullPath === initialPath) {
          bootNavigation.initialNavigations++
        }
        if (target.fullPath !== to) { return }
        resolve()
        await gate
        if (outcome === 'abort') { return false }
        if (outcome === 'throw') { throw new Error('boot navigation failed') }
      })
    })
    const removeHook = nuxtApp.hooks.beforeEach(({ name }) => {
      if (name === 'app:created') {
        bootNavigation.created = true
        removeHook()
      }
    })
    const bootNavigation = {
      created: false,
      initialNavigations: 0,
      release,
      finished: router.push(to).then(failure => failure?.type ?? null, error => error.message),
    }
    window.__bootNavigation = bootNavigation
    await started
  }, { to, outcome })
  await page.evaluate(() => window.__releaseBoot?.())
  await page.waitForFunction(() => window.__bootNavigation?.created)
}

test.describe('navigation during initial hydration', () => {
  test('browser back before hydration completes renders the previous page, and forward returns to it', async ({ page }) => {
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

    // the interrupted page renders cleanly when it is navigated to again
    await page.goForward()
    await page.waitForFunction(() => location.pathname === '/slow')
    await expect(page.getByTestId('slow-title')).toBeVisible()
    await expect(page.getByTestId('index-title')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)

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

    await startBootNavigation(page, '/')
    await page.evaluate(() => window.__bootNavigation!.release())

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('slow-title')).not.toBeAttached()
    await expect(page.getByTestId('default-layout')).toHaveCount(1)
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)
    expect(await page.evaluate(() => window.__bootNavigation!.initialNavigations)).toBe(0)

    expect(page).toHaveNoErrorsOrWarnings()
  })

  for (const outcome of ['abort', 'throw'] as const) {
    test(`a pending boot navigation that ${outcome}s falls back to the initial route`, async ({ page }) => {
      await page.goto('/?bootgate', { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => typeof window.__releaseBoot === 'function')

      await startBootNavigation(page, '/slow', outcome)
      const result = await page.evaluate(() => {
        window.__bootNavigation!.release()
        return window.__bootNavigation!.finished
      })

      expect(result).toBe(outcome === 'abort' ? NavigationFailureType.aborted : 'boot navigation failed')
      await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)
      expect(await page.evaluate(() => window.__bootNavigation!.initialNavigations)).toBe(1)
      expect(await page.evaluate(() => (window.useNuxtApp?.().$router as Router).currentRoute.value.fullPath)).toBe('/?bootgate')
      await expect(page.getByTestId('index-title')).toBeVisible()
      await expect(page.getByTestId('slow-title')).not.toBeAttached()

      expect(page).toHaveNoErrorsOrWarnings()
    })
  }

  test('a cancelled boot navigation does not replace a newer navigation', async ({ page }) => {
    await page.goto('/?bootgate', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => typeof window.__releaseBoot === 'function')

    await startBootNavigation(page, '/slow')
    await page.evaluate(() => (window.useNuxtApp?.().$router as Router).push('/?newer'))
    const result = await page.evaluate(() => {
      window.__bootNavigation!.release()
      return window.__bootNavigation!.finished
    })

    expect(result).toBe(NavigationFailureType.cancelled)
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)
    expect(await page.evaluate(() => window.__bootNavigation!.initialNavigations)).toBe(0)
    expect(await page.evaluate(() => (window.useNuxtApp?.().$router as Router).currentRoute.value.fullPath)).toBe('/?newer')
    await expect(page.getByTestId('index-title')).toBeVisible()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  for (const path of ['/slow', '/slow-other-layout', '/slow-inline']) {
    test(`a navigation from ${path} that finishes during boot hydrates the payload route and layout`, async ({ page }) => {
      // The router has moved before mounting, but the SSR DOM still belongs to the payload route.
      await page.goto(`${path}?bootgate`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => typeof window.__releaseBoot === 'function')

      await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/') })
      await page.waitForFunction(() => (window.useNuxtApp?.().$router as Router).currentRoute.value.path === '/')
      await page.evaluate(() => window.__releaseBoot?.())

      await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
      await expect(page.getByTestId('index-title')).toBeVisible()
      await expect(page.getByTestId('default-layout')).toHaveCount(1)
      await expect(page.getByTestId('other-layout')).not.toBeAttached()
      await expect(page.getByRole('heading')).toHaveText('index page')
      await expect(page.getByTestId('hydration-blocker')).not.toBeAttached()
      await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

      expect(page).toHaveNoErrorsOrWarnings()
    })
  }

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

  test('second navigation after a pending cross-layout target', async ({ page }) => {
    await gotoMidHydration(page, '/slow')

    // the first navigation pends on an async page in another layout, so the page
    // suspense is no longer hydrating but the root suspense still is
    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/async-target-other') })
    await page.waitForFunction(() => location.pathname === '/async-target-other')
    await expect(page.getByTestId('slow-title')).toBeVisible()

    // the second navigation must still be applied
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
})

declare global {
  interface Window {
    __bootNavigation?: {
      created: boolean
      initialNavigations: number
      release: () => void
      finished: Promise<unknown>
    }
    __releaseBoot?: () => void
    __releaseHydration?: () => void
    __releaseTarget?: () => void
  }
}
