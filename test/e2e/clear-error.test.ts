import { collectConsoleLogs, expect, fixtureDir, test } from './test-utils'

test.use({
  nuxt: {
    rootDir: fixtureDir('clear-error'),
  },
})

test.describe('clearError', () => {
  test('redirects without re-mounting the route that failed', async ({ page, goto }) => {
    await goto('/crash')
    await expect(page.getByTestId('error')).toHaveText('crashed')
    await page.evaluate(() => { (window as any).__record = [] })

    await page.getByTestId('clear').click()
    await expect(page.getByTestId('home')).toBeVisible()

    expect(new URL(page.url()).pathname).toBe('/')
    expect(await page.evaluate(() => (window as any).__record)).toEqual([
      'middleware:/',
      'index:mount',
      'error:unmount',
    ])
  })

  test('keeps the error page rendering the error until the redirect settles', async ({ page, goto }) => {
    await goto('/crash')
    await expect(page.getByTestId('error')).toHaveText('crashed')
    const logs = collectConsoleLogs(page)

    await page.getByTestId('clear-pending').click()
    await page.waitForFunction(() => (window as any).__release)
    await expect(page.getByTestId('error')).toHaveText('crashed')

    await page.evaluate(() => (window as any).__release())
    await expect(page.getByTestId('home')).toBeVisible()
    expect(logs.filter(log => log.type === 'error')).toEqual([])
  })

  test('shows a fatal error raised by the redirect', async ({ page, goto }) => {
    await goto('/crash')
    await expect(page.getByTestId('error')).toHaveText('crashed')

    await page.getByTestId('clear-forbidden').click()

    await expect(page.getByTestId('error')).toHaveText('forbidden')
    expect(new URL(page.url()).pathname).toBe('/forbidden')
  })
})
