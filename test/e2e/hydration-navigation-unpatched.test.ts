import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import type { Router } from 'vue-router'
import { unpatchedVue } from '../fixtures/hydration-navigation/unpatched-vue'
import { expect, test } from './test-utils'

test.describe.configure({ mode: 'serial' })
test.skip(({ builder }) => builder !== 'vite', 'The unpatched client runtime is configured through Vite.')

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/hydration-navigation', import.meta.url)),
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    // The dev subprocess reloads nuxt.config; production builds use nuxtConfig below.
    env: { TEST_UNPATCHED_VUE: '1' },
    nuxtConfig: {
      buildDir: `.nuxt-unpatched-${process.pid}`,
      vite: { plugins: [unpatchedVue()] },
    },
  },
})

for (const path of ['/slow', '/slow-other-layout', '/slow-inline']) {
  test(`a completed boot navigation from ${path} renders with Vue 3.5.42`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', (message) => {
      if (!['warning', 'error'].includes(message.type())) { return }
      const text = message.text()
      // The destination can differ from the SSR page after a completed boot navigation.
      if (/^\[Vue warn\]: Hydration (?:text content|children) mismatch/.test(text) || text === 'Hydration completed but contains mismatches.') { return }
      errors.push(text)
    })

    await page.goto(`${path}?bootgate`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => typeof window.__releaseBoot === 'function')
    expect(await page.evaluate(() => window.useNuxtApp?.().vueApp.version)).toBe('3.5.42')

    await page.evaluate(() => { (window.useNuxtApp?.().$router as Router).push('/') })
    await page.waitForFunction(() => (window.useNuxtApp?.().$router as Router).currentRoute.value.path === '/')
    await page.evaluate(() => window.__releaseBoot?.())

    await expect(page.getByRole('heading', { name: 'index page', exact: true })).toBeVisible()
    await expect(page.getByRole('heading')).toHaveText('index page')
    await expect(page.locator('header')).toHaveText('Default Layout')
    await expect(page.getByTestId('hydration-blocker')).not.toBeAttached()
    await expect(() => page.evaluate(() => window.useNuxtApp?.().isHydrating)).toBeWithPolling(false)

    await page.evaluate(() => window.__releaseHydration?.())
    await expect(page.getByRole('heading')).toHaveText('index page')
    await expect(page.locator('header')).toHaveText('Default Layout')
    expect(errors).toEqual([])
  })
}
