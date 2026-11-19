import { expect, fixtureDir, test } from './test-utils'

test.use({
  nuxt: {
    rootDir: fixtureDir('clear-error'),
  },
})

test.describe('clearError', () => {
  test('shows a fatal error raised by the redirect', async ({ page, goto }) => {
    await goto('/crash')
    await expect(page.getByTestId('error')).toHaveText('crashed')

    await page.getByTestId('clear-forbidden').click()

    await expect(page.getByTestId('error')).toHaveText('forbidden')
    expect(new URL(page.url()).pathname).toBe('/forbidden')
  })
})
