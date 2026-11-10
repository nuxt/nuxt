import type { Page } from '@playwright/test'
import { expect, fixtureDir, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir('ui-templates'),
  },
})

/** The app itself: in development the error page also carries the error overlay. */
function app (page: Page) {
  return page.locator('#__nuxt')
}

test.describe('error-404 template', () => {
  test('offers only the home link on a direct hit', async ({ page, goto }) => {
    await goto('/does-not-exist')

    await expect(app(page).getByRole('heading', { level: 1 })).toHaveText('404')
    await expect(page.locator('[data-back-home]')).toBeVisible()
    await expect(page.locator('[data-back-previous]')).toBeHidden()
  })

  test('offers a back button for in-app navigation and returns to the previous page', async ({ page, goto }) => {
    await goto('/')

    await page.getByTestId('broken-link').click()

    await expect(page.locator('[data-back-previous]')).toBeVisible()
    await expect(page.locator('[data-back-home]')).toBeHidden()

    await page.locator('[data-back-previous]').click()

    await expect(page.getByTestId('content')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/')
  })
})

test.describe('error-500 template', () => {
  test('renders the error template for a fatal error', async ({ page, goto }) => {
    await goto('/crash')

    await expect(app(page).getByRole('heading', { level: 1 })).toHaveText('500')
    await expect(app(page).getByRole('heading', { level: 2 })).toHaveText('Internal Server Error')
  })
})

test.describe('welcome template', () => {
  test('renders via <NuxtWelcome>', async ({ page, goto }) => {
    await goto('/welcome')

    await expect(page.getByRole('heading', { level: 2, name: 'Get started' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible()
  })
})
