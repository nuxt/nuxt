import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures/vapor', import.meta.url))

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('vapor interop', () => {
  test('renders and hydrates a vapor component inside a vdom page', async ({ page, goto }) => {
    await goto('/')
    await expect(page.getByTestId('page-title')).toHaveText('Vapor interop fixture')
    await expect(page.getByTestId('vapor-counter-button')).toHaveText('count is 0')

    await page.getByTestId('vapor-counter-button').click()
    await expect(page.getByTestId('vapor-counter-button')).toHaveText('count is 1')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('renders and hydrates a vapor page using nuxt composables', async ({ page, goto }) => {
    await goto('/vapor-page')
    await expect(page.getByTestId('page-title')).toHaveText('Vapor page')
    await expect(page.getByTestId('route-path')).toHaveText('/vapor-page')
    await expect(page.getByTestId('use-state')).toHaveText('state-initial')

    await page.getByTestId('vapor-counter-button').click()
    await expect(page.getByTestId('vapor-counter-button')).toHaveText('count is 1')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('hydrates mixed vapor/vdom nesting in both directions', async ({ page, goto }) => {
    await goto('/mixed')
    await expect(page.getByTestId('vdom-child').first()).toContainText('vdom child')
    await expect(page.getByTestId('vapor-wrapper').getByTestId('vdom-child')).toContainText('vdom child')
    await expect(page.getByTestId('vapor-counter-label')).toHaveText('vapor inside vdom slot')
    await expect(page.getByTestId('vapor-wrapper-text')).toHaveText('vapor wrapper')
    await expect(page.getByTestId('vapor-slot-content')).toHaveText('slot from vapor')

    await page.getByTestId('vapor-counter-button').click()
    await expect(page.getByTestId('vapor-counter-button')).toHaveText('count is 1')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('client-side navigation between vdom and vapor pages', async ({ page, goto }) => {
    await goto('/')
    await page.getByTestId('nav-vapor-page').click()
    await expect(page.getByTestId('page-title')).toHaveText('Vapor page')

    await page.getByTestId('nav-mixed').click()
    await expect(page.getByTestId('page-title')).toHaveText('Mixed nesting')

    await page.getByTestId('nav-index').click()
    await expect(page.getByTestId('page-title')).toHaveText('Vapor interop fixture')

    expect(page).toHaveNoErrorsOrWarnings()
  })
})
