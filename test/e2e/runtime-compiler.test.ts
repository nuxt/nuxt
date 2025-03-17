import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'
const isDev = process.env.TEST_ENV === 'dev'

const fixtureDir = fileURLToPath(new URL('../fixtures/runtime-compiler', import.meta.url))

test.describe.configure({ mode: isDev ? 'serial' : 'parallel' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: isDev,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      builder: isWebpack ? 'webpack' : 'vite',
      buildDir: isDev ? join(fixtureDir, '.nuxt', 'test', Math.random().toString(36).slice(2, 8)) : undefined,
    },
  },
})

test.describe('vue runtime compiler', () => {
  test('page should render without any error or logs', async ({ page, goto }) => {
    await goto('/')
    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('HelloWorld.vue component renders correctly', async ({ page, fetch, goto }) => {
    const response = await fetch('/')
    const html = await response.text()

    await goto('/')

    // Test both SSR and client-side rendering
    expect(html).toContain('<div data-testid="hello-world">hello, Helloworld.vue here ! </div>')
    await expect(page.getByTestId('hello-world')).toHaveText('hello, Helloworld.vue here !')
  })

  test('Name.ts component renders correctly', async ({ page, fetch, goto }) => {
    const response = await fetch('/')
    const html = await response.text()

    await goto('/')

    // Test both SSR and client-side rendering
    expect(html).toContain('I am the Name.ts component')
    await expect(page.getByTestId('name')).toHaveText('I am the Name.ts component')
  })

  test('ShowTemplate.ts component renders correctly', async ({ page, fetch, goto }) => {
    const response = await fetch('/')
    const html = await response.text()

    await goto('/')

    // Test both SSR and client-side rendering
    const expectedText = 'Hello my name is : John, i am defined by ShowTemplate.vue and my template is retrieved from the API'
    expect(html).toContain(expectedText)
    await expect(page.getByTestId('show-template')).toHaveText(expectedText)
  })

  test('Interactive component interaction works correctly', async ({ page, fetch, goto }) => {
    const response = await fetch('/')
    const html = await response.text()

    await goto('/')

    // Check initial render
    expect(html).toContain('I am defined by Interactive in the setup of App.vue. My full component definition is retrieved from the api')
    await expect(page.getByTestId('interactive')).toContainText('I am defined by Interactive in the setup of App.vue')

    // Test interaction
    const button = page.getByTestId('inc-interactive-count')
    await button.click()

    // Check reactivity
    await expect(page.getByTestId('interactive-count')).toHaveText('1')
    await button.click()
    await expect(page.getByTestId('interactive-count')).toHaveText('2')
  })

  test('ComponentDefinedInSetup renders and updates correctly', async ({ page, goto }) => {
    await goto('/')

    // Check initial render of the computed component
    await expect(page.getByTestId('component-defined-in-setup')).toContainText('hello i am defined in the setup of app.vue')
    await expect(page.getByTestId('computed-count')).toHaveText('0')

    // Click the increment button
    await page.getByTestId('increment-count').click()
    await expect(page.getByTestId('computed-count')).toHaveText('1')

    // Test multiple increments to ensure reactivity is working
    await page.getByTestId('increment-count').click()
    await expect(page.getByTestId('computed-count')).toHaveText('2')
  })

  test('Runtime compiler handles dynamic component templates', async ({ page, goto }) => {
    await goto('/')

    // Verify components created with runtime compiler render correctly
    await expect(page.getByTestId('hello-world')).toBeVisible()
    await expect(page.getByTestId('name')).toBeVisible()
    await expect(page.getByTestId('show-template')).toBeVisible()
    await expect(page.getByTestId('interactive')).toBeVisible()
    await expect(page.getByTestId('component-defined-in-setup')).toBeVisible()

    // Ensure no runtime errors when using the compiler
    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('Prop passing works correctly with runtime compiler', async ({ page, goto }) => {
    await goto('/')

    // Check prop passing for the ShowTemplate component
    await expect(page.getByTestId('show-template')).toContainText('John')

    // Check prop passing for the Interactive component
    await expect(page.getByTestId('interactive')).toContainText('Doe')
  })
})
