import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'
import { isBuilt, isWebpack } from '../matrix'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/hmr', import.meta.url))
const sourceDir = fileURLToPath(new URL('../fixtures/hmr', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    env: { TEST: '1' },
    nuxtConfig: {
      test: true,
    },
  },
})

if (isBuilt || isWindows) {
  test.skip('Skipped: HMR tests are skipped on Windows or in built mode', () => {})
} else {
  test.describe.configure({ mode: 'serial' })

  // Load the fixture file
  const indexVue = readFileSync(join(sourceDir, 'app/pages/index.vue'), 'utf8')

  test('basic HMR functionality', async ({ page, goto }) => {
    // Navigate to the page
    writeFileSync(join(fixtureDir, 'app/pages/index.vue'), indexVue)
    await goto('/')

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

    writeFileSync(join(fixtureDir, 'app/pages/index.vue'), newContents)

    // Wait for the title to be updated via HMR
    await expect(page).toHaveTitle('HMR fixture HMR')

    // Check content HMR
    const h1 = page.locator('h1')
    await expect(h1).toHaveText('Home page - but not as you knew it')

    // Check style HMR
    const h1Color = await h1.evaluate(el => window.getComputedStyle(el).getPropertyValue('color'))
    expect(h1Color).toBe('rgb(255, 0, 0)')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('detecting new routes', async ({ fetch }) => {
    // Try accessing a non-existent route
    await rm(join(fixtureDir, 'app/pages/some-404.vue'), { force: true })
    const res = await fetch('/some-404')
    expect(res.status).toBe(404)

    // Create a new page file
    writeFileSync(join(fixtureDir, 'app/pages/some-404.vue'), indexVue)

    // Wait for the new route to be available
    await expect(() => fetch('/some-404').then(r => r.status).catch(() => false)).toBeWithPolling(200)
  })

  test('hot reloading route rules', async ({ fetch }) => {
    // Check the initial header
    const file = readFileSync(join(sourceDir, 'app/pages/route-rules.vue'), 'utf8')
    writeFileSync(join(fixtureDir, 'app/pages/route-rules.vue'), file)

    await expect(() => fetch('/route-rules').then(r => r.headers.get('x-extend')).catch(() => null)).toBeWithPolling('added in routeRules')

    await new Promise(resolve => setTimeout(resolve, 100))

    // Modify the route rules
    writeFileSync(join(fixtureDir, 'app/pages/route-rules.vue'), file.replace('added in routeRules', 'edited in dev'))

    // Wait for the route rule to be hot reloaded
    await expect(() => fetch('/route-rules').then(r => r.headers.get('x-extend')).catch(() => null)).toBeWithPolling('edited in dev')
  })

  test('HMR for island components', async ({ page, goto }) => {
    // Navigate to the page with the island components
    await goto('/server-component')

    const componentPath = join(fixtureDir, 'app/components/islands/HmrComponent.vue')
    const componentContents = readFileSync(componentPath, 'utf8')

    // Test initial state of the component
    await expect(page.getByTestId('hmr-id')).toHaveText('0')

    // Function to update the component and check for changes
    const triggerHmr = (number: string) => writeFileSync(componentPath, componentContents.replace('ref(0)', `ref(${number})`))

    // First edit
    triggerHmr('1')
    await expect(page.getByTestId('hmr-id')).toHaveText('1', { timeout: 10000 })

    // Second edit to make sure HMR is working consistently
    triggerHmr('2')
    await expect(page.getByTestId('hmr-id')).toHaveText('2', { timeout: 10000 })

    expect(page).toHaveNoErrorsOrWarnings()
  })

  // Skip if using webpack since this test only works with Vite
  if (!isWebpack) {
    test('HMR for page meta', async ({ page, goto }) => {
      const pageContents = readFileSync(join(sourceDir, 'app/pages/page-meta.vue'), 'utf8')
      writeFileSync(join(fixtureDir, 'app/pages/page-meta.vue'), pageContents)

      await goto('/page-meta')

      // Check initial meta state
      await expect(page.getByTestId('meta')).toHaveText(JSON.stringify({ some: 'stuff' }, null, 2))

      // Update the meta
      writeFileSync(join(fixtureDir, 'app/pages/page-meta.vue'), pageContents.replace(`some: 'stuff'`, `some: 'other stuff'`))

      // Check if meta updates
      await expect(page.getByTestId('meta')).toHaveText(JSON.stringify({ some: 'other stuff' }, null, 2))

      // Verify no errors in console
      expect(page).toHaveNoErrorsOrWarnings()
    })

    test('HMR for routes', async ({ page, goto }) => {
      await goto('/routes')

      // Create a new route that doesn't exist yet
      writeFileSync(
        join(fixtureDir, 'app/pages/routes/non-existent.vue'),
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
      await expect(() => consoleLogs.some(log => log.text.includes('hmr'))).toBeWithPolling(true)

      // Navigate to the new route
      await page.locator('a[href="/routes/non-existent"]').click()

      // Verify the new route content is rendered
      await expect(page.getByTestId('contents')).toHaveText('A new route!')

      // Filter expected warnings about route not existing before the update
      const filteredLogs = consoleLogs.filter(log => (log.type === 'warning' || log.type === 'error') && !log.text.includes('No match found for location with path "/routes/non-existent"'))

      // Verify no unexpected errors
      expect(filteredLogs).toStrictEqual([])
    })

    test('should allow hmr with useAsyncData (#32177)', async ({ page, goto }) => {
      await goto('/issues/32177')

      const pageContents = readFileSync(join(sourceDir, 'app/pages/issues/32177.vue'), 'utf8')
      writeFileSync(join(fixtureDir, 'app/pages/issues/32177.vue'), pageContents.replace('// #HMR_REPLACE', 'console.log("hmr")'))
      await expect(page.getByTestId('contents')).toHaveText('Element 1, Element 2')
    })

    test('HMR with top-level await', async ({ page, goto }) => {
      const pageContents = readFileSync(join(sourceDir, 'app/pages/top-level-await.vue'), 'utf8')
      writeFileSync(join(fixtureDir, 'app/pages/top-level-await.vue'), pageContents)

      // Navigate and wait for full load
      await goto('/top-level-await')
      await expect(page.getByTestId('content')).toHaveText('loaded')

      // Trigger HMR by editing script
      writeFileSync(
        join(fixtureDir, 'app/pages/top-level-await.vue'),
        pageContents.replace('console.log(\'page loaded\')', '// console.log(\'page loaded\')'),
      )

      // Wait for HMR to process and check no errors
      await page.waitForTimeout(1000)
      expect(page).toHaveNoErrorsOrWarnings()
    })
  }
}
