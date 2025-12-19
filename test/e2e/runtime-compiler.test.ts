import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'
import { isDev } from '../matrix'

/**
 * This test suite verifies that Vue's runtime compiler works correctly within Nuxt,
 * testing various ways of using runtime-compiled components across multiple pages.
 */

const fixtureDir = fileURLToPath(new URL('../fixtures/runtime-compiler', import.meta.url))

// Run tests in parallel in production mode, but serially in dev mode
// to avoid interference between HMR and test execution
test.describe.configure({ mode: isDev ? 'serial' : 'parallel' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: isDev,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      buildDir: isDev ? join(fixtureDir, '.nuxt', 'test', Math.random().toString(36).slice(2, 8)) : undefined,
    },
  },
})

test.describe('Runtime compiler functionality', () => {
  /**
   * Tests that the overview page loads without errors
   */
  test('should render the overview page without errors', async ({ page, goto }) => {
    await goto('/')
    await expect(page.getByTestId('page-title')).toHaveText('Nuxt Runtime Compiler Tests')
    expect(page).toHaveNoErrorsOrWarnings()
  })

  /**
   * Tests the basic component with template string
   */
  test('should render HelloWorld.vue with template string via runtime compiler', async ({ page, goto }) => {
    await goto('/basic-component')

    await expect(page.getByTestId('hello-world')).toHaveText('hello, Helloworld.vue here !')
    expect(page).toHaveNoErrorsOrWarnings()
  })

  /**
   * Tests the component with computed template
   */
  test('should render and update ComponentDefinedInSetup with reactive template', async ({ page, goto }) => {
    await goto('/component-in-setup')

    // Check initial render
    await expect(page.getByTestId('component-defined-in-setup')).toContainText('hello i am defined in the setup of app.vue')
    await expect(page.getByTestId('computed-count')).toHaveText('0')

    // Update counter
    await page.getByTestId('increment-count').click()

    // Check updated template
    await expect(page.getByTestId('computed-count')).toHaveText('1')

    // Multiple updates
    await page.getByTestId('increment-count').click()
    await expect(page.getByTestId('computed-count')).toHaveText('2')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  /**
   * Tests the TypeScript component with render function
   */
  test('should render Name.ts component using render function', async ({ page, goto }) => {
    await goto('/typescript-component')

    await expect(page.getByTestId('name')).toHaveText('I am the Name.ts component')
    expect(page).toHaveNoErrorsOrWarnings()
  })

  /**
   * Tests a component with template from API
   */
  test('should render ShowTemplate component with template from API', async ({ page, goto }) => {
    await goto('/api-template')

    const expectedText = 'Hello my name is : John, i am defined by ShowTemplate.vue and my template is retrieved from the API'
    await expect(page.getByTestId('show-template')).toHaveText(expectedText)
    expect(page).toHaveNoErrorsOrWarnings()
  })

  /**
   * Tests a fully dynamic component with both template and script from API
   */
  test('should render and update Interactive component with template and script from API', async ({ page, goto }) => {
    await goto('/full-dynamic')

    // Check initial render
    await expect(page.getByTestId('interactive')).toContainText('I am defined by Interactive in the setup of App.vue')
    await expect(page.getByTestId('interactive')).toContainText('my name is Doe John')

    // Test reactivity
    const button = page.getByTestId('inc-interactive-count')
    await button.click()
    await expect(page.getByTestId('interactive-count')).toHaveText('1')

    // Test continued reactivity
    await button.click()
    await expect(page.getByTestId('interactive-count')).toHaveText('2')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  /**
   * Tests navigation between pages and verifies all components are reachable
   */
  test('should allow navigation between all test cases', async ({ page, goto }) => {
    await goto('/')

    // Navigate to each page and verify
    const pages = [
      { path: '/basic-component', text: 'Basic Component Test' },
      { path: '/component-in-setup', text: 'Computed Template Test' },
      { path: '/typescript-component', text: 'TypeScript Component Test' },
      { path: '/api-template', text: 'API Template Test' },
      { path: '/full-dynamic', text: 'Full Dynamic Component Test' },
    ]

    for (const { path, text } of pages) {
      // Click navigation link
      await page.getByRole('link', { name: new RegExp(text.split(' ')[0]!, 'i') }).click()

      // Verify page title
      await expect(page.locator('h2')).toContainText(text)

      // Check URL
      expect(page.url()).toContain(path)

      // Verify no errors
      expect(page).toHaveNoErrorsOrWarnings()
    }
  })
})
