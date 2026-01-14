import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'
import { isDev } from '../matrix'

const fixtureDir = fileURLToPath(new URL('../fixtures/layout-reactivity', import.meta.url))

test.describe.configure({ mode: isDev ? 'serial' : 'parallel' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: isDev,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      buildDir: isDev ? join(fixtureDir, '.nuxt', 'test', Math.random().toString(36).slice(2, 8)) : undefined,
    },
  },
})

test.describe('Layout reactivity with async setup (#33680)', () => {
  test('should maintain reactivity in layout after navigation', async ({ page, goto }) => {
    await goto('/')
    await expect(page.getByTestId('page-title')).toHaveText('Home Page')

    // Verify toggle works before navigation
    await expect(page.getByTestId('toggle-value')).toHaveText('OFF')
    await page.getByTestId('toggle-btn').click()
    await expect(page.getByTestId('toggle-value')).toHaveText('ON')
    await expect(page.getByTestId('search-box')).toBeVisible()

    // Reset and navigate
    await page.getByTestId('toggle-btn').click()
    await expect(page.getByTestId('toggle-value')).toHaveText('OFF')

    await page.getByTestId('link-other').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/other')
    await expect(page.getByTestId('page-title')).toHaveText('Other Page')

    // Toggle should still work after navigation
    await page.getByTestId('toggle-btn').click()
    await expect(page.getByTestId('toggle-value')).toHaveText('ON')
    await expect(page.getByTestId('search-box')).toBeVisible()
  })
})
