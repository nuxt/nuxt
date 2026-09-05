import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/preview', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('PreviewOnly', () => {
  test('renders PreviewOnly on the server using the configured preview state', async ({ request }) => {
    const published = await request.get('/preview-only')
    expect(published.ok()).toBe(true)
    expect(await published.text()).toContain('id="preview-only-fallback"')
    expect(await published.text()).not.toContain('id="preview-only-content"')

    const preview = await request.get('/preview-only?preview=true')
    expect(preview.ok()).toBe(true)
    expect(await preview.text()).toContain('id="preview-only-content"')
    expect(await preview.text()).not.toContain('id="preview-only-fallback"')
  })

  test('updates PreviewOnly after hydrating a prerendered page with a preview query', async ({ page, goto, request, isDev }) => {
    test.skip(isDev, 'Requires prerendered HTML')
    const response = await request.get('/preview-only-prerendered?preview=true')
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).toContain('id="preview-only-fallback"')
    expect(html).not.toContain('id="preview-only-content"')

    await goto('/preview-only-prerendered?preview=true')
    await expect(page.locator('#preview-only-content')).toBeVisible()
    await expect(page.locator('#preview-only-fallback')).toHaveCount(0)

    await page.locator('#toggle-preview-only').click()
    await expect(page.locator('#preview-only-fallback')).toBeVisible()
    await expect(page.locator('#preview-only-content')).toHaveCount(0)

    await page.locator('#toggle-preview-only').click()
    await expect(page.locator('#preview-only-content')).toBeVisible()
    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('does not claim preview initialization before custom options are supplied', async ({ page, goto }) => {
    await goto('/preview-only-delayed?preview=true')
    await expect(page.locator('#preview-only-fallback')).toBeVisible()
    await page.locator('#initialize-preview-only').click()
    await expect(page.locator('#preview-only-fallback')).toBeVisible()
    await expect(page.locator('#preview-only-enable-calls')).toHaveText('0')

    await goto('/preview-only-delayed?customPreview=true')
    await expect(page.locator('#preview-only-fallback')).toBeVisible()
    await page.locator('#initialize-preview-only').click()
    await expect(page.locator('#preview-only-content')).toBeVisible()
    await expect(page.locator('#preview-only-enable-calls')).toHaveText('1')

    await page.locator('#initialize-preview-only').click()
    await expect(page.locator('#preview-only-enable-calls')).toHaveText('1')

    await page.locator('#disable-preview-only').click()
    await expect(page.locator('#preview-only-fallback')).toBeVisible()
    await expect(page.locator('#preview-only-disable-calls')).toHaveText('1')
    expect(page).toHaveNoErrorsOrWarnings()
  })
})
