import { fileURLToPath } from 'node:url'
import { expect, test } from './test-utils'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/route-scroll-custom', import.meta.url)),
  },
})

test('custom scroll behavior controls reload restoration (#26797)', async ({ page, goto }) => {
  await goto('/big-page-1')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200)
  expect(await page.evaluate(() => window.history.scrollRestoration)).toBe('manual')

  await page.evaluate(() => window.scrollTo(0, 600))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)
  await page.reload()

  // The browser must not restore 600px before the custom handler can run.
  await expect(page.locator('html')).toHaveAttribute('data-scroll-start', '0')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200)
})

test('custom scroll behavior still receives saved positions on back navigation', async ({ page, goto }) => {
  await goto('/big-page-1')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200)
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)

  await page.locator('#big-page-2').dispatchEvent('click')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200)
  await page.goBack()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)
})

test('calls the custom handler once when middleware aborts the startup replacement', async ({ page, goto }) => {
  await goto('/big-page-1?abortStartup')
  await expect(page.locator('html')).toHaveAttribute('data-scroll-calls', '1')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200)
})

test('a plugin navigation during reload receives its own scroll position', async ({ page, goto }) => {
  await goto('/big-page-1')
  await page.evaluate(() => {
    sessionStorage.setItem('navigate-on-reload', '1')
    window.scrollTo(0, 600)
  })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)
  await page.reload()
  await expect(page).toHaveURL(/\/big-page-2$/)
  await expect(page.locator('html')).toHaveAttribute('data-scroll-from', '/big-page-1')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200)
})

for (const path of ['/big-page-1', '/big-page-2']) {
  test(`can opt out of restoration when ${path} reloads before the router starts`, async ({ page }) => {
    let resumeScripts!: () => void
    const scriptsReady = new Promise<void>((resolve) => { resumeScripts = resolve })
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() === 'script') { await scriptsReady }
      await route.continue()
    })
    try {
      await page.goto(path + '?keepScroll', { waitUntil: 'commit' })
      await page.waitForFunction(() => document.documentElement.scrollHeight > innerHeight + 600)
      expect(await page.evaluate(() => history.scrollRestoration)).toBe('manual')
      await page.evaluate(() => window.scrollTo(0, 600))
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)
      await page.reload({ waitUntil: 'commit' })
      await page.waitForFunction(() => document.readyState === 'interactive')
    } finally {
      resumeScripts()
    }
    await expect(page.locator('html')).toHaveAttribute('data-scroll-calls', '1')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })
}

test('preserves native restoration on scriptless routes', async ({ page }) => {
  for (const path of ['/nested/scriptless/test', '/nested/scriptless/spa']) {
    await page.goto(path)
    expect(await page.evaluate(() => history.scrollRestoration)).toBe('auto')
  }
})
