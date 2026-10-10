import { fileURLToPath } from 'node:url'
import { expect, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/navigation-abort-404', import.meta.url)),
    // the dev projects share this fixture and never write to it, but each needs its own dev server
    env: { NUXT_IGNORE_LOCK: '1' },
  },
})

test.describe('aborted navigation', () => {
  test('keeps the current page without rendering a 404', async ({ page, goto }) => {
    await goto('/')

    await page.locator('#abort').click()
    // the bogus 404 (if it were rendered) happens asynchronously after the failed navigation
    await page.waitForTimeout(500)

    await expect(page.locator('h1')).toHaveText('Home')
    await expect(page.locator('body')).not.toContainText('404')
  })

  test('still renders a 404 for a successful navigation to an unknown route', async ({ page, goto }) => {
    await goto('/')

    await page.locator('#unknown').click()

    await expect(page.locator('body')).toContainText('404')
  })
})
