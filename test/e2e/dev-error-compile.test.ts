import { isWindows } from 'std-env'
import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'
import { useDevErrorFixture } from './dev-error-fixture'

const fixture = useDevErrorFixture('dev-error-compile')

test.use({
  nuxt: {
    rootDir: fixture.fixtureDir,
    dev: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe.configure({ mode: 'serial' })

test.afterEach(() => fixture.restore())

const TARGET = 'app/pages/compile-target.vue'

interface CompileCase {
  title: string
  break: (healthy: string) => string
  message: string | RegExp
  /** The error name the overlay should show, when the compiler raises a named error. */
  name?: string
  /** Set while the compiler's name is lost on the way to a report raised by a hot update. */
  nameIsLostOverHmr?: boolean
}

const cases: CompileCase[] = [
  {
    title: 'a template that does not close a tag',
    break: healthy => healthy.replace('<div>{{ message }}</div>', '<span\n    {{ message }}\n  </span>'),
    message: 'Illegal',
    name: 'SyntaxError',
  },
  {
    title: 'a script block that does not parse',
    break: healthy => healthy.replace('const message', 'const x: = 1\nconst message'),
    message: 'Unexpected token',
    name: 'SyntaxError',
    nameIsLostOverHmr: true,
  },
  {
    title: 'an import that cannot be resolved',
    break: healthy => healthy.replace('<script setup lang="ts">\n', '<script setup lang="ts">\nimport { nope } from \'~/utils/does-not-exist\'\nvoid nope\n'),
    message: /Failed to resolve import|does-not-exist/,
  },
]

const overlayOf = (page: Page) => page.locator('nuxt-error-overlay')

async function expectCompileOverlay (page: Page, scenario: CompileCase) {
  const overlay = overlayOf(page)
  await expect(overlay).toHaveCount(1, { timeout: 30_000 })
  await expect(overlay.locator('.mb-message').first()).toContainText(scenario.message, { timeout: 30_000 })
  await expect(overlay.locator('.mb-message').first()).not.toContainText('Failed to fetch dynamically imported module')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

for (const scenario of cases) {
  test(`overlays ${scenario.title} introduced while the page is open`, async ({ page, goto }) => {
    const healthy = fixture.read(TARGET)
    await goto('/compile-target')
    await expect(page.locator('body')).toContainText('compile target healthy')
    await expect(overlayOf(page)).toHaveCount(0)

    fixture.write(TARGET, scenario.break(healthy))
    await expectCompileOverlay(page, scenario)

    fixture.write(TARGET, healthy)
    await expect(overlayOf(page)).toHaveCount(0, { timeout: 30_000 })
    await expect(page.locator('body')).toContainText('compile target healthy', { timeout: 30_000 })
  })

  test(`overlays ${scenario.title} on a fresh load`, async ({ page }) => {
    const healthy = fixture.read(TARGET)
    fixture.write(TARGET, scenario.break(healthy))

    await page.goto('/compile-target')
    await expectCompileOverlay(page, scenario)

    // the error page reloads itself once the report clears
    const reloaded = page.waitForEvent('load', { timeout: 30_000 }).then(() => true, () => false)
    fixture.write(TARGET, healthy)
    await expect(overlayOf(page)).toHaveCount(0, { timeout: 30_000 })
    if (!await reloaded) {
      await page.goto('/compile-target')
    }
    await expect(page.locator('body')).toContainText('compile target healthy', { timeout: 30_000 })
  })

  if (scenario.name) {
    test(`names ${scenario.title} on a fresh load after the error the compiler raised`, async ({ page }) => {
      fixture.write(TARGET, scenario.break(fixture.read(TARGET)))

      await page.goto('/compile-target')
      await expect(overlayOf(page).locator('.mb-name').first()).toContainText(scenario.name!, { timeout: 30_000 })
    })

    test(`names ${scenario.title} introduced over hmr after the error the compiler raised`, async ({ page, goto }) => {
      // a hot update reports the wrapper `vue/compiler-sfc` rethrows the parser error as,
      // rather than the `SyntaxError` the same failure is named on a fresh load
      test.fail(!!scenario.nameIsLostOverHmr)
      const healthy = fixture.read(TARGET)
      await goto('/compile-target')
      fixture.write(TARGET, scenario.break(healthy))

      await expect(overlayOf(page).locator('.mb-name').first()).toContainText(scenario.name!, { timeout: 30_000 })
    })
  }
}
