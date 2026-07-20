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

    await page.getByTestId('vapor-counter-button').click({ timeout: 5000 })
    await expect(page.getByTestId('vapor-counter-button')).toHaveText('count is 1')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('nuxt composables work in a vapor component inside a vdom page', async ({ page, goto }) => {
    await goto('/composables')
    await expect(page.getByTestId('nuxt-app')).toHaveText('nuxt-app-ok')
    await expect(page.getByTestId('state')).toHaveText('state-ok')
    await expect(page.getByTestId('route-path')).toHaveText('/composables')
    await expect(page.getByTestId('router')).toHaveText('router-ok')
    await expect(page.getByTestId('runtime-config')).toHaveText('runtime-config-ok')
    await expect(page.getByTestId('attrs')).toHaveText('attrs-ok')
    await expect(page.getByTestId('ready')).toHaveText('ready')
    await expect(page.getByTestId('async-data')).toHaveText('world (success)')
    await expect(page).toHaveTitle('vapor head title')
    expect(await page.locator('meta[name=description]').getAttribute('content')).toBe('vapor seo description')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('useId hydrates without mismatch in a vapor component', async ({ page, goto }) => {
    await goto('/composables')
    await expect(page.getByTestId('use-id')).not.toHaveText('id-missing')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('element template refs work in a vapor component', async ({ page, goto }) => {
    await goto('/composables')
    await expect(page.getByTestId('refs')).toHaveText('el:ok')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  // nested vapor components inside a vapor component hit the same hydration
  // mismatch recovery bug as vapor pages, even when hosted in a vdom page
  test('hydrates a vapor component nested inside another vapor component', async ({ page, goto }) => {
    await goto('/nested')
    await expect(page.getByTestId('vapor-counter-label')).toHaveText('vapor in vapor')
    await expect(page.getByTestId('nested-refs')).toHaveText('comp:ok $el:absent')

    await page.getByTestId('vapor-counter-button').click({ timeout: 5000 })
    await expect(page.getByTestId('vapor-counter-button')).toHaveText('count is 1')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  // lazy hydration wrappers rely on vdom async component hydration strategies,
  // which never hydrate a vapor component: it renders on the server but stays inert
  test.fail('lazy hydration (hydrate-on-visible) of a vapor component', async ({ page, goto }) => {
    await goto('/lazy')
    await expect(page.getByTestId('vapor-counter-label')).toHaveText('lazy vapor')

    await page.getByTestId('vapor-counter-button').scrollIntoViewIfNeeded()
    await page.getByTestId('vapor-counter-button').click()
    await expect(page.getByTestId('vapor-counter-button')).toHaveText('count is 1', { timeout: 5000 })

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

test.describe('vapor async data', () => {
  test('ssr + hydration of a vapor page with top-level await', async ({ page, goto }) => {
    await goto('/async-await')
    await expect(page.getByTestId('await-message')).toHaveText('resolved after await')

    await page.getByTestId('nav-index').click()
    await expect(page.getByTestId('page-title')).toHaveText('Vapor interop fixture')

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('ssr + hydration of awaited useAsyncData in a vapor page, with refresh', async ({ page, goto }) => {
    await goto('/async-data')
    await expect(page.getByTestId('data-greeting')).toHaveText('hello from api')
    await expect(page.getByTestId('data-status')).toHaveText('success')

    const countText = await page.getByTestId('data-count').textContent()
    await page.getByTestId('refresh-button').click()
    await expect(page.getByTestId('data-count')).not.toHaveText(countText!)
    await expect(page.getByTestId('data-status')).toHaveText('success')
  })

  test('ssr + hydration of awaited useAsyncData in a vdom page, with refresh', async ({ page, goto }) => {
    await goto('/vdom-async-data')
    await expect(page.getByTestId('data-greeting')).toHaveText('hello from api')
    await expect(page.getByTestId('data-status')).toHaveText('success')

    const countText = await page.getByTestId('data-count').textContent()
    await page.getByTestId('refresh-button').click()
    await expect(page.getByTestId('data-count')).not.toHaveText(countText!)

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('lazy useAsyncData in a vapor page resolves after client-side navigation', async ({ page, goto }) => {
    await goto('/async-await')
    await page.getByTestId('nav-lazy-data').click()
    await expect(page.getByTestId('page-title')).toHaveText('Lazy data vapor page')
    await expect(page.getByTestId('data-status')).toHaveText('success')
    await expect(page.getByTestId('data-greeting')).toHaveText('hello from api')
  })

  test('navigation to a vapor page with async setup blocks and shows the loading indicator', async ({ page, goto }) => {
    await goto('/')
    await page.getByTestId('nav-slow').click()

    await expect(page.getByTestId('page-title')).toHaveText('Vapor interop fixture')
    await expect.poll(() => page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.nuxt-loading-indicator')
      return el ? getComputedStyle(el).opacity !== '0' : false
    })).toBe(true)

    await expect(page.getByTestId('page-title')).toHaveText('Slow vapor page')
  })

  test('onServerPrefetch and callOnce in a vapor page', async ({ page, goto }) => {
    await goto('/prefetch')
    await expect(page.getByTestId('prefetched')).toHaveText('prefetched-on-server')
    await expect(page.getByTestId('once-count')).toHaveText('once: 1')

    await page.getByTestId('nav-index').click()
    await expect(page.getByTestId('page-title')).toHaveText('Vapor interop fixture')
    await page.getByTestId('nav-prefetch').click()
    await expect(page.getByTestId('once-count')).toHaveText('once: 1')
    await expect(page.getByTestId('prefetched')).toHaveText('prefetched-on-server')
  })

  test('client-side navigation between two vapor pages with async setup', async ({ page, goto }) => {
    await goto('/async-await')
    await page.getByTestId('nav-slow').click()
    await expect(page.getByTestId('page-title')).toHaveText('Slow vapor page')
    await expect(page.getByTestId('data-greeting')).toHaveText('hello from api')

    await page.getByTestId('nav-async-data').click()
    await expect(page.getByTestId('page-title')).toHaveText('Async data vapor page')
    await expect(page.getByTestId('data-greeting')).toHaveText('hello from api')
    await expect(page.getByTestId('data-status')).toHaveText('success')
  })

  // on the first client-side navigation from a vdom page to a vapor page,
  // useAsyncData refs never update the DOM: awaited useAsyncData shows an empty
  // page with status `idle` (dev only), lazy useAsyncData is stuck on `pending`
  // (dev and built). navigating from another vapor page works.
  test('client-side navigation from a vdom page to a vapor page with awaited useAsyncData', async ({ page, goto }, testInfo) => {
    test.fail(testInfo.project.name.endsWith('-dev'), 'vapor page render effects lose the fetched data on first vdom -> vapor navigation in dev')
    await goto('/')
    await page.getByTestId('nav-async-data').click()
    await expect(page.getByTestId('page-title')).toHaveText('Async data vapor page')
    await expect(page.getByTestId('data-greeting')).toHaveText('hello from api')
    await expect(page.getByTestId('data-status')).toHaveText('success')
  })

  test.fail('client-side navigation from a vdom page to a vapor page with lazy useAsyncData', async ({ page, goto }) => {
    await goto('/')
    await page.getByTestId('nav-lazy-data').click()
    await expect(page.getByTestId('page-title')).toHaveText('Lazy data vapor page')
    await expect(page.getByTestId('data-status')).toHaveText('success')
    await expect(page.getByTestId('data-greeting')).toHaveText('hello from api')
  })
})
