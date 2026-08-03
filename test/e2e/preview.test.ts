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

test.describe('preview mode', () => {
  test('respects preview mode with a token', async ({ page, goto }) => {
    const token = 'hehe'
    await goto(`/?preview=true&token=${token}`)

    // @ts-expect-error untyped
    const consoleLogs: Array<{ type: string, text: string }> = page._consoleLogs
    await expect.poll(() => consoleLogs.some(log => log.text === 'true'), { timeout: 8000 }).toBe(true)

    await expect(page.locator('#fetched-on-client')).toContainText('fetched on client')
    await expect(page.locator('#preview-mode')).toContainText('preview mode enabled')

    await page.click('#use-fetch-check')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath.includes('/with-use-fetch'))

    await expect(page.locator('#token-check')).toContainText(token, { timeout: 15_000 })
    await expect(page.locator('#correct-api-key-check')).toContainText('true', { timeout: 15_000 })
  })

  test('respects preview mode with custom state', async ({ page, goto }) => {
    await goto('/with-custom-state?preview=true')

    await expect(page.locator('#data1')).toContainText('data1 updated')
    await expect(page.locator('#data2')).toContainText('data2')

    await page.click('#toggle-preview') // manually turns off preview mode
    await page.click('#with-use-fetch')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath.includes('/with-use-fetch'))

    await expect(page.locator('#enabled')).toContainText('false')
    await expect(page.locator('#token-check')).toHaveText('')
    await expect(page.locator('#correct-api-key-check')).toContainText('false')
  })

  test('respects preview mode with custom enable', async ({ page, goto }) => {
    await goto('/with-custom-enable?preview=true')

    await expect(page.locator('#enabled')).toContainText('false')
  })

  test('respects preview mode with custom enable and customPreview', async ({ page, goto }) => {
    await goto('/with-custom-enable?customPreview=true')

    await expect(page.locator('#enabled')).toContainText('true')
  })
})
