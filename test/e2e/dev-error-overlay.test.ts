import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/dev-error-sourcemap', import.meta.url))
const sourceDir = fileURLToPath(new URL('../fixtures/dev-error-sourcemap', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe.configure({ mode: 'serial' })

// checkouts on Windows have CRLF line endings, which the patterns below do not
const appVue = readFileSync(join(sourceDir, 'app/app.vue'), 'utf8').replaceAll('\r\n', '\n')
const brokenAppVue = appVue.replace('    rendered without error\n', '    <span\n      rendered without error\n    </span>\n')
if (brokenAppVue === appVue) {
  throw new Error('the fixture no longer contains the line these tests break; update `brokenAppVue`')
}

test('shows the error overlay on an open page when a file stops compiling, and removes it when fixed', async ({ page, goto }) => {
  writeFileSync(join(fixtureDir, 'app/app.vue'), appVue)
  await goto('/ok')
  await expect(page.locator('body')).toContainText('rendered without error')
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(0)

  writeFileSync(join(fixtureDir, 'app/app.vue'), brokenAppVue)
  const overlay = page.locator('nuxt-error-overlay')
  await expect(overlay).toHaveCount(1)
  await expect(overlay.locator('.mb-overlay')).toHaveAttribute('data-minimized', '')
  await expect(overlay.locator('.mb-name')).toContainText('SyntaxError')
  await expect(overlay.locator('.mb-message')).toContainText('Illegal')
  await expect(overlay.locator('.mb-loc')).toContainText('app.vue')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)

  writeFileSync(join(fixtureDir, 'app/app.vue'), appVue)
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(0)
})

test('reloads the error page once the file compiles again', async ({ page }) => {
  writeFileSync(join(fixtureDir, 'app/app.vue'), brokenAppVue)
  // the error page has no app to hydrate, so no hydration wait
  await page.goto('/ok')
  await expect(page.locator('.mb-message').first()).toContainText('Illegal')

  writeFileSync(join(fixtureDir, 'app/app.vue'), appVue)
  // the frame quotes the fixed line too, so wait for the page it reloads into
  await expect(page.locator('.mb-message')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('body')).toContainText('rendered without error')
})

test('opens a frame through the channel, and through the editor URL when the channel refuses the page', async ({ page }) => {
  writeFileSync(join(fixtureDir, 'app/app.vue'), appVue)
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
