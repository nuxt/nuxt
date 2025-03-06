import { promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { $fetch, waitForHydration } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import { glob } from 'tinyglobby'

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/hmr', import.meta.url))
const sourceDir = fileURLToPath(new URL('../fixtures/hmr', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: true,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    env: {
      TEST: '1',
    },
    nuxtConfig: {
      test: true,
      builder: isWebpack ? 'webpack' : 'vite',
    },
  },
})
if (process.env.TEST_ENV === 'built' || isWindows) {
  test.skip('Skipped: HMR tests are skipped on Windows or in built mode', () => {})
} else {
  test.describe('HMR', () => {
    test.describe.configure({ mode: 'serial' })

    test.beforeAll(async () => {
    // reset pages directory
      const pagesDir = join(fixtureDir, 'pages')
      for (const file of await glob('**/*.vue', { cwd: pagesDir })) {
        await fsp.rm(join(pagesDir, file), { force: true })
      }
      const sourcePagesDir = join(sourceDir, 'pages')
      for (const file of await glob('**/*.vue', { cwd: sourcePagesDir })) {
        await fsp.cp(join(sourcePagesDir, file), join(pagesDir, file))
      }
    })

    test('basic HMR functionality', async ({ page }) => {
    // Load the fixture file
      const indexVue = await fsp.readFile(join(fixtureDir, 'pages/index.vue'), 'utf8')

      // Navigate to the page
      await page.goto('/')
      await waitForHydration(page, '/', 'hydration')

      // Check initial state
      await expect(page).toHaveTitle('HMR fixture')
      await expect(page.locator('[data-testid="count"]')).toHaveText('1')

      // Test reactivity
      await page.locator('button').click()
      await expect(page.locator('[data-testid="count"]')).toHaveText('2')

      // Modify the file and check for HMR updates
      let newContents = indexVue
        .replace('<Title>HMR fixture</Title>', '<Title>HMR fixture HMR</Title>')
        .replace('<h1>Home page</h1>', '<h1>Home page - but not as you knew it</h1>')
      newContents += '<style scoped>\nh1 { color: red }\n</style>'

      await fsp.writeFile(join(fixtureDir, 'pages/index.vue'), newContents)

      // Wait for the title to be updated via HMR
      await expectWithPolling(() => page.title(), 'HMR fixture HMR')

      // Check content HMR
      const h1 = page.locator('h1')
      await expect(h1).toHaveText('Home page - but not as you knew it')

      // Check style HMR
      const h1Color = await h1.evaluate(el => window.getComputedStyle(el).getPropertyValue('color'))
      expect(h1Color).toBe('rgb(255, 0, 0)')

      // Check console for errors
      const consoleLogs: Array<{ type: string, text: string }> = []
      page.on('console', (msg) => {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
        })
      })

      expect(expectNoErrorsOrWarnings(consoleLogs)).toBe(true)
    })

    test('detecting new routes', async ({ request }) => {
    // Try accessing a non-existent route
      const res = await request.get('/some-404')
      expect(res.status()).toBe(404)

      // Create a new page file
      const indexVue = await fsp.readFile(join(fixtureDir, 'pages/index.vue'), 'utf8')
      await fsp.writeFile(join(fixtureDir, 'pages/some-404.vue'), indexVue)

      // Wait for the new route to be available
      await expectWithPolling(() =>
        $fetch<string>('/some-404')
          .then(r => r.includes('Home page'))
          .catch(() => false),
      true,
      )
    })

    test('hot reloading route rules', async ({ request }) => {
    // Check the initial header
      await expectWithPolling(() =>
        request.get('/route-rules')
          .then(r => r.headers()['x-extend'])
          .catch(() => null),
      'added in routeRules',
      )

      // Modify the route rules
      const file = await fsp.readFile(join(fixtureDir, 'pages/route-rules.vue'), 'utf8')
      await fsp.writeFile(
        join(fixtureDir, 'pages/route-rules.vue'),
        file.replace('added in routeRules', 'edited in dev'),
      )

      // Wait for the route rule to be hot reloaded
      await expectWithPolling(() =>
        request.get('/route-rules')
          .then(r => r.headers()['x-extend'])
          .catch(() => null),
      'edited in dev',
      )
    })

    test('HMR for island components', async ({ page }) => {
    // Navigate to the page with the island components
      await page.goto('/server-component')
      await waitForHydration(page, '/server-component', 'hydration')

      const componentPath = join(fixtureDir, 'components/islands/HmrComponent.vue')
      const componentContents = await fsp.readFile(componentPath, 'utf8')

      // Test initial state of the component
      await expectWithPolling(async () => await page.getByTestId('hmr-id').innerText(), '0')

      // Function to update the component and check for changes
      const triggerHmr = async (number: string) => {
        await fsp.writeFile(componentPath, componentContents.replace('ref(0)', `ref(${number})`))
      }

      // First edit
      await triggerHmr('1')
      await expectWithPolling(async () => await page.getByTestId('hmr-id').innerText(), '1')

      // Second edit to make sure HMR is working consistently
      await triggerHmr('2')
      await expectWithPolling(async () => await page.getByTestId('hmr-id').innerText(), '2')

      // Check for console errors
      const consoleLogs: Array<{ type: string, text: string }> = []
      page.on('console', (msg) => {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
        })
      })

      expect(expectNoErrorsOrWarnings(consoleLogs)).toBe(true)
    })

    // Skip if using webpack since this test only works with Vite
    if (!isWebpack) {
      test('HMR for page meta', async ({ page }) => {
        await page.goto('/page-meta')
        await waitForHydration(page, '/page-meta', 'hydration')

        const pagePath = join(fixtureDir, 'pages/page-meta.vue')
        const pageContents = await fsp.readFile(pagePath, 'utf8')

        // Check initial meta state
        await expect(page.getByTestId('meta')).toHaveText(JSON.stringify({ some: 'stuff' }, null, 2))

        // Track console logs
        const consoleLogs: Array<{ type: string, text: string }> = []
        page.on('console', (msg) => {
          consoleLogs.push({
            type: msg.type(),
            text: msg.text(),
          })
        })

        // Update the meta
        await fsp.writeFile(pagePath, pageContents.replace(`some: 'stuff'`, `some: 'other stuff'`))

        // Check if meta updates
        await expectWithPolling(
          async () => await page.getByTestId('meta').textContent() || '{}',
          JSON.stringify({ some: 'other stuff' }, null, 2),
        )

        // Verify no errors in console
        expect(expectNoErrorsOrWarnings(consoleLogs)).toBe(true)
      })

      test('HMR for routes', async ({ page }) => {
        await page.goto('/routes')
        await waitForHydration(page, '/routes', 'hydration')

        // Create a new route that doesn't exist yet
        await fsp.writeFile(
          join(fixtureDir, 'pages/routes/non-existent.vue'),
          `<template><div data-testid="contents">A new route!</div></template>`,
        )

        // Track console logs
        const consoleLogs: Array<{ type: string, text: string }> = []
        page.on('console', (msg) => {
          consoleLogs.push({
            type: msg.type(),
            text: msg.text(),
          })
        })

        // Wait for HMR to process the new route
        await expectWithPolling(() =>
          consoleLogs.some(log => log.text.includes('hmr')),
        true,
        )

        // Navigate to the new route
        await page.locator('a[href="/routes/non-existent"]').click()

        // Verify the new route content is rendered
        await expectWithPolling(
          () => page.getByTestId('contents').textContent(),
          'A new route!',
        )

        // Filter expected warnings about route not existing before the update
        const filteredLogs = consoleLogs.filter((log) => {
          if (log.text.includes('No match found for location with path "/routes/non-existent"')) {
            return false
          }
          return true
        })

        // Verify no unexpected errors
        expect(expectNoErrorsOrWarnings(filteredLogs)).toBe(true)
      })
    }
  })
}

// Utility function to wait for a condition to be true
async function expectWithPolling<T> (
  getter: () => Promise<T> | T,
  expected: T | ((val: T) => boolean),
  options: { timeout?: number, interval?: number, message?: string } = {},
): Promise<T> {
  const { timeout = 20000, interval = 300, message } = options
  const startTime = Date.now()
  let lastValue: T
  let lastError: Error | undefined

  // Create a matcher function
  const matcher = typeof expected === 'function'
    ? expected as ((val: T) => boolean)
    : (val: T) => val === expected

  while (Date.now() - startTime < timeout) {
    try {
      lastValue = await getter()
      if (matcher(lastValue)) {
        return lastValue
      }
    } catch (err) {
      lastError = err as Error
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  // If we've reached here, the condition wasn't met
  const errorMessage = message || `Timed out after ${timeout}ms waiting for condition to be met.`

  if (lastError) {
    throw new Error(`${errorMessage}\nLast error: ${lastError.message}`)
  }

  throw new Error(`${errorMessage}\nExpected: ${expected}\nReceived: ${lastValue!}`)
}

// Helper function to check for errors in the console logs
function expectNoErrorsOrWarnings (consoleLogs: Array<{ type: string, text: string }>) {
  const errorLogs = consoleLogs.filter(log =>
    log.type === 'error' || (log.type === 'warning' && !log.text.includes('webpack/hot/dev-server')))

  if (errorLogs.length > 0) {
    console.error('Found error logs:', errorLogs)
    return false
  }
  return true
}
