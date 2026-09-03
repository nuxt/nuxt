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

const appVue = readFileSync(join(sourceDir, 'app/app.vue'), 'utf8')
const brokenAppVue = appVue.replace('    rendered without error\n', '    <span\n      rendered without error\n    </span>\n')

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
  // the frame on the error page quotes the fixed line too, so wait for the
  // page it reloads into rather than for the text alone
  await expect(page.locator('.mb-message')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('body')).toContainText('rendered without error')
})
