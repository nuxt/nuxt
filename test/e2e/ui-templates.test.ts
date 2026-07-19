import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { waitForHydration } from '@nuxt/test-utils'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures/ui-templates', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('error-404 template', () => {
  test('offers only the home link on a direct hit', async ({ page }) => {
    await page.goto('/does-not-exist')
    await waitForHydration(page, '/does-not-exist', 'hydration')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404')
    await expect(page.locator('[data-back-home]')).toBeVisible()
    await expect(page.locator('[data-back-previous]')).toBeHidden()
  })

  test('offers a back button for in-app navigation and returns to the previous page', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page, '/', 'hydration')

    await page.getByTestId('broken-link').click()

    await expect(page.locator('[data-back-previous]')).toBeVisible()
    await expect(page.locator('[data-back-home]')).toBeHidden()

    await page.locator('[data-back-previous]').click()

    await expect(page.getByTestId('content')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/')
  })
})

test.describe('error-500 template', () => {
  test('renders the error template for a fatal error', async ({ page }) => {
    await page.goto('/crash')
    await waitForHydration(page, '/crash', 'hydration')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('500')
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Internal Server Error')
  })
})

test.describe('welcome template', () => {
  test('renders via <NuxtWelcome>', async ({ page }) => {
    await page.goto('/welcome')
    await waitForHydration(page, '/welcome', 'hydration')

    await expect(page.getByRole('heading', { level: 2, name: 'Get started' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible()
  })
})
