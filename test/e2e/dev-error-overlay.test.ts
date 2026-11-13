import { expect, test } from './test-utils'
import { tempFixtureDir } from './temp-fixture'

test.use({
  nuxt: {
    rootDir: tempFixtureDir('dev-error-overlay'),
  },
})

test.describe.configure({ mode: 'serial' })

test('shows the error page with no overlay when a page throws an expected 404', async ({ page, goto }) => {
  await goto('/ok')
  await page.getByRole('link', { name: 'to expected 404' }).click()

  await expect(page.locator('body')).toContainText('custom error page: 404')
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(0)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})

test('overlays the error page when a page throws a fatal 500', async ({ page, goto }) => {
  await goto('/ok')
  await page.getByRole('link', { name: 'to expected 500' }).click()

  await expect(page.locator('body')).toContainText('custom error page: 500')
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(1)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})

test('reports a thrown value that is not an error', async ({ page, goto }) => {
  await goto('/ok')
  await page.getByRole('link', { name: 'to teapot' }).click()

  const overlay = page.locator('nuxt-error-overlay')
  await expect(overlay).toHaveCount(1)
  await expect(overlay.locator('.mb-message')).toContainText('Thrown value')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})

test('does not overlay an error the browser raised on a page loaded afterwards', async ({ page, goto }) => {
  await goto('/click-boom')
  await page.getByRole('button', { name: 'throw' }).click()
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(1)

  const ready = page.waitForEvent('websocket').then(ws => ws.waitForEvent('framesent', frame => String(frame.payload).includes('nuxt:dev:error:ready')))
  await page.reload()
  await ready
  await page.waitForTimeout(1000)
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(0)

  await page.getByRole('button', { name: 'throw' }).click()
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(1)
})

test('does not overlay a ResizeObserver loop notice', async ({ page, goto }) => {
  await goto('/click-boom')

  await page.evaluate(() => new Promise<void>((resolve) => {
    window.addEventListener('error', () => resolve(), { once: true })
    const box = document.createElement('div')
    document.body.append(box)
    let resized = false
    new ResizeObserver(() => {
      if (resized) { return }
      resized = true
      box.style.height = '120px'
    }).observe(box)
  }))
  await page.getByRole('button', { name: 'throw' }).click()

  const overlay = page.locator('nuxt-error-overlay')
  await expect(overlay).toHaveCount(1)
  await expect(overlay.locator('.mb-message')).toContainText('boom from a click')
  await expect(overlay).not.toContainText('Thrown value: null')
})

test('overlays a thrown null', async ({ page, goto }) => {
  await goto('/ok')

  await page.addScriptTag({ content: 'setTimeout(() => { throw null })' })

  const overlay = page.locator('nuxt-error-overlay')
  await expect(overlay).toHaveCount(1)
  await expect(overlay.locator('.mb-message')).toContainText('Thrown value: null')
})

test('opens a frame through the channel, and through the editor URL when the channel refuses the page', async ({ page }) => {
  const opens: string[] = []
  // answered here so a run never launches the editor of the machine it is on
  await page.route('**/__nuxt_dev__/error/open', (route) => {
    opens.push(route.request().url())
    return route.fulfill({ status: 200, body: '' })
  })
  const frame = () => page.locator('nuxt-error-overlay').locator('.mb-loc').first()

  await page.goto('/boom-page')
  await expect(frame()).toHaveCount(1)
  await frame().evaluate((el: HTMLElement) => el.click())
  await expect.poll(() => opens.length).toBe(1)

  // a peer the channel will not talk to still gets the frame, and must not ask it to open
  await page.route('**/__nuxt_dev__/error/events*', route => route.fulfill({ status: 403, body: '' }))
  await page.reload()
  await expect(frame()).toHaveCount(1)
  await frame().evaluate((el: HTMLElement) => el.click())
  await page.waitForTimeout(1000)
  expect(opens).toHaveLength(1)
})
