import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/dev-error-client', import.meta.url))
const sourceDir = fileURLToPath(new URL('../fixtures/dev-error-client', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe.configure({ mode: 'serial' })

const appVue = readFileSync(join(sourceDir, 'app/app.vue'), 'utf8').replaceAll('\r\n', '\n')

test('overlays an error the browser raised, minimised over the app, and clears it on the next update', async ({ page, goto }) => {
  writeFileSync(join(fixtureDir, 'app/app.vue'), appVue)
  await goto('/')
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(0)

  await page.getByRole('button', { name: 'throw' }).click()

  const overlay = page.locator('nuxt-error-overlay')
  await expect(overlay).toHaveCount(1)
  await expect(overlay.locator('.mb-overlay')).toHaveAttribute('data-minimized', '')
  await expect(overlay.locator('.mb-message')).toContainText('boom from a click')
  // the position comes from the browser's stack, resolved through the module graph
  await expect(overlay.locator('.mb-loc').first()).toContainText('app.vue')
  await expect(page.locator('body')).toContainText('rendered without error')

  writeFileSync(join(fixtureDir, 'app/app.vue'), appVue.replace('rendered without error', 'rendered after the fix'))
  await expect(overlay).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('body')).toContainText('rendered after the fix')
})
