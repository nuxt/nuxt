import { expect, fixtureDir, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir('runtime-compiler'),
  },
})

test.describe('Runtime compiler functionality', () => {
  test.afterEach(({ page }) => {
    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('should render the overview page without errors', async ({ page, goto }) => {
    await goto('/')
    await expect(page.getByTestId('page-title')).toHaveText('Nuxt Runtime Compiler Tests')
  })

  test('should render HelloWorld.vue with template string via runtime compiler', async ({ page, goto }) => {
    await goto('/basic-component')
    await expect(page.getByTestId('hello-world')).toHaveText('hello, Helloworld.vue here !')
  })

  test('should render and update ComponentDefinedInSetup with reactive template', async ({ page, goto }) => {
    await goto('/component-in-setup')
    await expect(page.getByTestId('component-defined-in-setup')).toContainText('hello i am defined in the setup of app.vue')
    await expect(page.getByTestId('computed-count')).toHaveText('0')

    for (const count of ['1', '2']) {
      await page.getByTestId('increment-count').click()
      await expect(page.getByTestId('computed-count')).toHaveText(count)
    }
  })

  test('should render Name.ts component using render function', async ({ page, goto }) => {
    await goto('/typescript-component')
    await expect(page.getByTestId('name')).toHaveText('I am the Name.ts component')
  })

  test('should render ShowTemplate component with template from API', async ({ page, goto }) => {
    await goto('/api-template')
    await expect(page.getByTestId('show-template')).toHaveText('Hello my name is : John, i am defined by ShowTemplate.vue and my template is retrieved from the API')
  })

  test('should render and update Interactive component with template and script from API', async ({ page, goto }) => {
    await goto('/full-dynamic')
    await expect(page.getByTestId('interactive')).toContainText('I am defined by Interactive in the setup of App.vue')
    await expect(page.getByTestId('interactive')).toContainText('my name is Doe John')

    for (const count of ['1', '2']) {
      await page.getByTestId('inc-interactive-count').click()
      await expect(page.getByTestId('interactive-count')).toHaveText(count)
    }
  })

  test('should allow navigation between all test cases', async ({ page, goto }) => {
    await goto('/')

    const pages = [
      { path: '/basic-component', text: 'Basic Component Test' },
      { path: '/component-in-setup', text: 'Computed Template Test' },
      { path: '/typescript-component', text: 'TypeScript Component Test' },
      { path: '/api-template', text: 'API Template Test' },
      { path: '/full-dynamic', text: 'Full Dynamic Component Test' },
    ]

    for (const { path, text } of pages) {
      await page.getByRole('link', { name: new RegExp(text.split(' ')[0]!, 'i') }).click()
      await expect(page.locator('h2')).toContainText(text)
      expect(page.url()).toContain(path)
    }
  })
})
