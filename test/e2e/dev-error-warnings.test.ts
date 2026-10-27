import { isWindows } from 'std-env'
import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'
import { useDevErrorFixture } from './dev-error-fixture'

const fixture = useDevErrorFixture('dev-error-warnings')

test.use({
  nuxt: {
    rootDir: fixture.fixtureDir,
    dev: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe.configure({ mode: 'serial' })

test.afterEach(() => fixture.restore())

const badgeOf = (page: Page) => page.locator('nuxt-error-overlay-badge').getByRole('button')

function breakLink () {
  fixture.replace('app/pages/ok.vue', '    ok page\n', '    ok page\n    <NuxtLink to="/nowhere">\n      nowhere\n    </NuxtLink>\n')
}

test('shows a template warning on every open page, and retires it once fixed', async ({ page, goto }) => {
  await goto('/ok')
  const other = await page.context().newPage()
  try {
    await other.goto('/click-boom')
    await expect(other.locator('body')).toContainText('click boom healthy')
    await expect(badgeOf(page)).toBeHidden()

    breakLink()
    for (const open of [page, other]) {
      await expect(badgeOf(open)).toContainText('1 warning', { timeout: 30_000 })
    }

    fixture.restore()
    for (const open of [page, other]) {
      await expect(badgeOf(open)).toBeHidden({ timeout: 30_000 })
    }
  } finally {
    await other.close()
  }
})

test('opens a warning the page was rendered with from the badge, and stops showing it once fixed', async ({ page, goto }) => {
  breakLink()
  await goto('/ok')
  await badgeOf(page).click({ timeout: 30_000 })

  const overlay = page.locator('nuxt-error-overlay')
  await expect(overlay.locator('.mb-message')).toContainText('/nowhere')

  fixture.restore()
  await expect(overlay.getByText('/nowhere')).toHaveCount(0, { timeout: 30_000 })
  await expect(badgeOf(page)).toBeHidden()
})
