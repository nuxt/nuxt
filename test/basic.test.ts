import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { joinURL, withQuery } from 'ufo'
import { isCI, isWindows } from 'std-env'
import { join, normalize } from 'pathe'
import { $fetch, createPage, fetch, isDev, setup, startServer, url, useTestContext } from '@nuxt/test-utils/e2e'
import { $fetchComponent } from '@nuxt/test-utils/experimental'
import { createRegExp, exactly } from 'magic-regexp'

import { expectNoClientErrors, expectWithPolling, gotoPath, isRenderingJson, parseData, parsePayload, renderPage } from './utils'

import type { NuxtIslandResponse } from '#app'

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'
const isTestingAppManifest = process.env.TEST_MANIFEST !== 'manifest-off'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  dev: process.env.TEST_ENV === 'dev',
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
  nuxtConfig: {
    hooks: {
      'modules:done' () {
        // TODO: investigate whether to upstream a fix to vite-plugin-vue or nuxt/test-utils
        // Vite reads its `isProduction` value from NODE_ENV and passes this to some plugins
        // like vite-plugin-vue
        if (process.env.TEST_ENV !== 'dev') {
          process.env.NODE_ENV = 'production'
        }
      },
    },
    builder: isWebpack ? 'webpack' : 'vite',
  },
})

describe('server api', () => {
  it('should serialize', async () => {
    expect(await $fetch<string>('/api/hello')).toBe('Hello API')
    expect(await $fetch('/api/hey')).toEqual({
      foo: 'bar',
      baz: 'qux',
    })
  })

  it('should preserve states', async () => {
    expect(await $fetch('/api/counter')).toEqual({ count: 0 })
    expect(await $fetch('/api/counter')).toEqual({ count: 1 })
    expect(await $fetch('/api/counter')).toEqual({ count: 2 })
    expect(await $fetch('/api/counter')).toEqual({ count: 3 })
  })

  it('should auto-import', async () => {
    const res = await $fetch('/api/auto-imports')
    expect(res).toMatchInlineSnapshot(`
      {
        "autoImported": "utils",
        "fromServerDir": "test-utils",
        "thisIs": "serverAutoImported",
      }
    `)
  })
})

describe('route rules', () => {
  it('should enable spa mode', async () => {
    const headHtml = await $fetch<string>('/route-rules/spa')

    // SPA should render appHead tags
    expect(headHtml).toContain('<meta name="description" content="Nuxt Fixture">')
    expect(headHtml).toContain('<meta charset="utf-8">')
    expect(headHtml).toContain('<meta name="viewport" content="width=1024, initial-scale=1">')
    expect(headHtml.match(/<meta name="viewport" content="width=1024, initial-scale=1">/g)).toHaveLength(1)

    const { script, attrs } = parseData(headHtml)
    expect(script.serverRendered).toEqual(false)
    if (isRenderingJson) {
      expect(attrs['data-ssr']).toEqual('false')
    }
    await expectNoClientErrors('/route-rules/spa')
  })

  it('should not render loading template in spa mode if it is not enabled', async () => {
    const html = await $fetch<string>('/route-rules/spa')
    expect(html).toContain('<div id="__nuxt"></div>')
  })

  it('should allow defining route rules inline', async () => {
    const res = await fetch('/route-rules/inline')
    expect(res.status).toEqual(200)
    expect(res.headers.get('x-extend')).toEqual('added in routeRules')
  })

  it('test noScript routeRules', async () => {
    const html = await $fetch<string>('/no-scripts')
    expect(html).not.toContain('<script')
  })

  it.runIf(isTestingAppManifest)('should run middleware defined in routeRules config', async () => {
    const html = await $fetch<string>('/route-rules/middleware')
    expect(html).toContain('Hello from routeRules!')
  })
})

describe('modules', () => {
  it('should auto-register modules in ~/modules', async () => {
    const result = await $fetch<string>('/auto-registered-module')
    expect(result).toEqual('handler added by auto-registered module')
  })
})

describe('pages', () => {
  it('render index', async () => {
    const html = await $fetch<string>('/')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    // should render text
    expect(html).toContain('Hello Nuxt 3!')
    // should inject runtime config
    expect(html).toContain('RuntimeConfig | testConfig: 123')
    expect(html).toContain('needsFallback:')
    // composables auto import
    expect(html).toContain('Composable | foo: auto imported from ~/composables/foo.ts')
    expect(html).toContain('Composable | bar: auto imported from ~/utils/useBar.ts')
    expect(html).toContain('Composable | template: auto imported from ~/composables/template.ts')
    expect(html).toContain('Composable | star: auto imported from ~/composables/nested/bar.ts via star export')
    // should import components
    expect(html).toContain('This is a custom component with a named export.')
    // should remove dev-only and replace with any fallback content
    expect(html).toContain(isDev() ? 'Some dev-only info' : 'Some prod-only info')
    // should apply attributes to client-only components
    expect(html).toContain('<div style="color:red;" class="client-only"></div>')
    // should render server-only components
    expect(html.replaceAll(/ data-island-uid="[^"]*"/g, '')).toContain('<div class="server-only" style="background-color:gray;"> server-only component <div> server-only component child (non-server-only) </div></div>')
    // should register global components automatically
    expect(html).toContain('global component registered automatically')
    expect(html).toContain('global component via suffix')
    expect(html).toContain('This is a synchronously registered global component')

    await expectNoClientErrors('/')
  })

  // TODO: support jsx with webpack
  it.runIf(!isWebpack)('supports jsx', async () => {
    const html = await $fetch<string>('/jsx')

    // should import JSX/TSX components with custom elements
    expect(html).toContain('TSX component')
    expect(html).toContain('<custom-component>custom</custom-component>')
    expect(html).toContain('Sugar Counter 12 x 2 = 24')
  })

  it('respects aliases in page metadata', async () => {
    const html = await $fetch<string>('/some-alias')
    expect(html).toContain('Hello Nuxt 3!')
  })

  it('respects redirects in page metadata', async () => {
    const { headers } = await fetch('/redirect', { redirect: 'manual' })
    expect(headers.get('location')).toEqual('/')
  })

  it('allows routes to be added dynamically', async () => {
    const html = await $fetch<string>('/add-route-test')
    expect(html).toContain('Hello Nuxt 3!')
  })

  it('includes page metadata from pages added in pages:extend hook', async () => {
    const res = await fetch('/page-extend')
    expect(res.headers.get('x-extend')).toEqual('added in pages:extend')
  })

  it('preserves page metadata added in pages:extend hook', async () => {
    const html = await $fetch<string>('/some-custom-path')
    expect (html.match(/<pre>([^<]*)<\/pre>/)?.[1]?.trim().replace(/&quot;/g, '"').replace(/&gt;/g, '>')).toMatchInlineSnapshot(`
      "{
        "name": "some-custom-name",
        "path": "/some-custom-path",
        "validate": "() => true",
        "middleware": [
          "() => true"
        ],
        "otherValue": "{\\"foo\\":\\"bar\\"}"
      }"
    `)
  })

  it('validates routes', async () => {
    const { status, headers } = await fetch('/catchall/forbidden')
    expect(status).toEqual(404)
    expect(headers.get('Set-Cookie')).toBe('set-in-plugin=true; Path=/')

    const { page } = await renderPage('/navigate-to-forbidden')

    await page.getByText('should throw a 404 error').click()
    expect(await page.getByRole('heading').textContent()).toMatchInlineSnapshot('"Page Not Found: /catchall/forbidden"')
    expect(await page.getByTestId('path').textContent()).toMatchInlineSnapshot('" Path: /catchall/forbidden"')

    await gotoPath(page, '/navigate-to-forbidden')
    await page.getByText('should be caught by catchall').click()
    expect(await page.getByRole('heading').textContent()).toMatchInlineSnapshot('"[...slug].vue"')

    await page.close()
  })

  it('validates routes with custom statusCode and statusMessage', async () => {
    const CUSTOM_ERROR_CODE = 401
    const CUSTOM_ERROR_MESSAGE = 'Custom error message'
    const ERROR_PAGE_TEXT = 'This is the error page'
    const PAGE_TEXT = 'You should not see this'

    // Check status code and message on fetch
    const res = await fetch('/validate-custom-error')
    const serverText = await res.text()

    expect(res.status).toEqual(CUSTOM_ERROR_CODE)
    expect(serverText).toContain(CUSTOM_ERROR_MESSAGE)
    expect(serverText).not.toContain(PAGE_TEXT)

    // Client-side navigation
    const { page } = await renderPage('/navigate-to-validate-custom-error')
    await page.getByText('should throw a 401 error with custom message').click()
    // error.vue has an h1 tag
    await page.waitForSelector('h1')

    const clientText = await page.innerText('body')

    expect(clientText).toContain(CUSTOM_ERROR_MESSAGE)
    expect(clientText).toContain(ERROR_PAGE_TEXT)
    expect(clientText).not.toContain(PAGE_TEXT)

    await page.close()

    // Server-side navigation
    const { page: serverPage } = await renderPage('/validate-custom-error')
    const serverPageText = await serverPage.innerText('body')

    expect(serverPageText).toContain(CUSTOM_ERROR_MESSAGE)
    expect(serverPageText).toContain(ERROR_PAGE_TEXT)
    expect(serverPageText).not.toContain(PAGE_TEXT)

    await serverPage.close()
  })

  it.runIf(isDev())('returns 500 when there is an infinite redirect', async () => {
    const { status } = await fetch('/catchall/redirect-infinite', { redirect: 'manual' })
    expect(status).toEqual(500)
  })

  it('render catchall page', async () => {
    const res = await fetch('/catchall/not-found')
    expect(res.status).toEqual(200)

    const html = await res.text()

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('[...slug].vue')
    expect(html).toContain('catchall at not-found')

    // Middleware still runs after validation: https://github.com/nuxt/nuxt/issues/15650
    expect(html).toContain('Middleware ran: true')

    await expectNoClientErrors('/catchall/not-found')
  })

  it('should render correctly when loaded on a different path', async () => {
    const { page, pageErrors } = await renderPage()
    await page.goto(url('/proxy'))
    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)

    expect(await page.innerText('body')).toContain('Composable | foo: auto imported from ~/composables/foo.ts')
    expect(pageErrors).toEqual([])

    await page.close()
  })

  it('preserves query', async () => {
    const html = await $fetch<string>('/?test=true')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    // should render text
    expect(html).toContain('Path: /?test=true')

    await expectNoClientErrors('/?test=true')
  })

  it('/nested/[foo]/[bar].vue', async () => {
    const html = await $fetch<string>('/nested/one/two')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('nested/[foo]/[bar].vue')
    expect(html).toContain('foo: one')
    expect(html).toContain('bar: two')
  })

  it('/nested/[foo]/index.vue', async () => {
    const html = await $fetch<string>('/nested/foobar')

    // TODO: should resolved to same entry
    // const html2 = await $fetch<string>('/nested/foobar/index')
    // expect(html).toEqual(html2)

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('nested/[foo]/index.vue')
    expect(html).toContain('foo: foobar')

    await expectNoClientErrors('/nested/foobar')
  })

  it('/nested/[foo]/user-[group].vue', async () => {
    const html = await $fetch<string>('/nested/foobar/user-admin')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('nested/[foo]/user-[group].vue')
    expect(html).toContain('foo: foobar')
    expect(html).toContain('group: admin')

    await expectNoClientErrors('/nested/foobar/user-admin')
  })

  it('/parent', async () => {
    const html = await $fetch<string>('/parent')
    expect(html).toContain('parent/index')

    await expectNoClientErrors('/parent')
  })

  it('/another-parent', async () => {
    const html = await $fetch<string>('/another-parent')
    expect(html).toContain('another-parent/index')

    await expectNoClientErrors('/another-parent')
  })

  it('/client-server', async () => {
    // expect no hydration issues
    await expectNoClientErrors('/client-server')
    const { page } = await renderPage('/client-server')
    const bodyHTML = await page.innerHTML('body')
    expect(await page.locator('.placeholder-to-ensure-no-override').all()).toHaveLength(5)
    expect(await page.locator('.server').all()).toHaveLength(0)
    expect(await page.locator('.client-fragment-server.client').all()).toHaveLength(2)
    expect(await page.locator('.client-fragment-server-fragment.client').all()).toHaveLength(2)
    expect(await page.locator('.client-server.client').all()).toHaveLength(1)
    expect(await page.locator('.client-server-fragment.client').all()).toHaveLength(1)
    expect(await page.locator('.client-server-fragment.client').all()).toHaveLength(1)

    expect(bodyHTML).not.toContain('hello')
    expect(bodyHTML).toContain('world')
    await page.close()
  })

  it('/client-only-components', async () => {
    const html = await $fetch<string>('/client-only-components')
    // ensure fallbacks with classes and arbitrary attributes are rendered
    expect(html).toContain('<div class="client-only-script" foo="bar">')
    expect(html).toContain('<div class="client-only-script-setup" foo="hello">')
    expect(html).toContain('<div>Fallback</div>')
    // ensure components are not rendered server-side
    expect(html).not.toContain('Should not be server rendered')

    const { page, pageErrors } = await renderPage('/client-only-components')

    const hiddenSelectors = [
      '.string-stateful-should-be-hidden',
      '.client-script-should-be-hidden',
      '.string-stateful-script-should-be-hidden',
      '.no-state-hidden',
    ]
    const visibleSelectors = [
      '.string-stateful',
      '.string-stateful-script',
      '.client-only-script',
      '.client-only-script-setup',
      '.no-state',
    ]

    // ensure directives are correctly applied
    await Promise.all(hiddenSelectors.map(selector => page.locator(selector).isHidden()))
      .then(results => results.forEach(isHidden => expect(isHidden).toBeTruthy()))
    // ensure hidden components are still rendered
    await Promise.all(hiddenSelectors.map(selector => page.locator(selector).innerHTML()))
      .then(results => results.forEach(innerHTML => expect(innerHTML).not.toBe('')))

    // ensure single root node components are rendered once on client (should not be empty)
    await Promise.all(visibleSelectors.map(selector => page.locator(selector).innerHTML()))
      .then(results => results.forEach(innerHTML => expect(innerHTML).not.toBe('')))

    // issue #20061
    expect(await page.$eval('.client-only-script-setup', e => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 0, 0)')

    // ensure multi-root-node is correctly rendered
    expect(await page.locator('.multi-root-node-count').innerHTML()).toContain('0')
    expect(await page.locator('.multi-root-node-button').innerHTML()).toContain('add 1 to count')
    expect(await page.locator('.multi-root-node-script-count').innerHTML()).toContain('0')
    expect(await page.locator('.multi-root-node-script-button').innerHTML()).toContain('add 1 to count')

    // ensure components reactivity
    await page.locator('.multi-root-node-button').click()
    await page.locator('.multi-root-node-script-button').click()
    await page.locator('.client-only-script button').click()
    await page.locator('.client-only-script-setup button').click()

    expect(await page.locator('.multi-root-node-count').innerHTML()).toContain('1')
    expect(await page.locator('.multi-root-node-script-count').innerHTML()).toContain('1')
    expect(await page.locator('.client-only-script-setup button').innerHTML()).toContain('1')
    expect(await page.locator('.client-only-script button').innerHTML()).toContain('1')

    // ensure components ref is working and reactive
    await page.locator('button.test-ref-1').click()
    await page.locator('button.test-ref-2').click()
    await page.locator('button.test-ref-3').click()
    await page.locator('button.test-ref-4').click()
    expect(await page.locator('.client-only-script-setup button').innerHTML()).toContain('2')
    expect(await page.locator('.client-only-script button').innerHTML()).toContain('2')
    expect(await page.locator('.string-stateful-script').innerHTML()).toContain('1')
    expect(await page.locator('.string-stateful').innerHTML()).toContain('1')
    const waitForConsoleLog = page.waitForEvent('console', consoleLog => consoleLog.text() === 'has $el')

    // ensure directives are reactive
    await page.locator('button#show-all').click()
    await Promise.all(hiddenSelectors.map(selector => page.locator(selector).isVisible()))
      .then(results => results.forEach(isVisible => expect(isVisible).toBeTruthy()))

    await waitForConsoleLog
    expect(pageErrors).toEqual([])
    await page.close()
    // don't expect any errors or warning on client-side navigation
    const { page: page2, consoleLogs: consoleLogs2 } = await renderPage('/')
    await page2.locator('#to-client-only-components').click()
    await page2.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/client-only-components')
    expect(consoleLogs2.some(log => log.type === 'error' || log.type === 'warning')).toBeFalsy()
    await page2.close()
  })

  it('/wrapper-expose/layout', async () => {
    const { page, consoleLogs, pageErrors } = await renderPage('/wrapper-expose/layout')
    await page.locator('.log-foo').first().click()
    expect(pageErrors.at(-1)?.toString() || consoleLogs.at(-1)!.text).toContain('.logFoo is not a function')
    await page.locator('.log-hello').first().click()
    expect(consoleLogs.at(-1)!.text).toContain('world')
    await page.locator('.add-count').first().click()
    expect(await page.locator('.count').first().innerText()).toContain('1')

    // change layout
    await page.locator('.swap-layout').click()
    await page.waitForFunction(() => document.querySelector('.count')?.innerHTML.includes('0'))
    await page.locator('.log-foo').first().click()
    expect(consoleLogs.at(-1)!.text).toContain('bar')
    await page.locator('.log-hello').first().click()
    expect(pageErrors.at(-1)?.toString() || consoleLogs.at(-1)!.text).toContain('.logHello is not a function')
    await page.locator('.add-count').first().click()
    await page.waitForFunction(() => document.querySelector('.count')?.innerHTML.includes('1'))
    // change layout
    await page.locator('.swap-layout').click()
    await page.waitForFunction(() => document.querySelector('.count')?.innerHTML.includes('0'))
    await page.close()
  })

  it('/client-only-explicit-import', async () => {
    const html = await $fetch<string>('/client-only-explicit-import')

    // ensure fallbacks with classes and arbitrary attributes are rendered
    expect(html).toContain('<div class="client-only-script" foo="bar">')
    expect(html).toContain('<div class="lazy-client-only-script-setup" foo="hello">')
    // ensure components are not rendered server-side
    expect(html).not.toContain('client only script')
    await expectNoClientErrors('/client-only-explicit-import')
  })

  it('/wrapper-expose/page', async () => {
    const { page, pageErrors, consoleLogs } = await renderPage('/wrapper-expose/page')
    await page.waitForLoadState('networkidle')
    await page.locator('#log-foo').click()
    expect(consoleLogs.at(-1)?.text).toBe('bar')
    // change page
    await page.locator('#to-hello').click()
    await page.locator('#log-foo').click()
    expect(pageErrors.at(-1)?.toString() || consoleLogs.at(-1)!.text).toContain('.foo is not a function')
    await page.locator('#log-hello').click()
    expect(consoleLogs.at(-1)?.text).toBe('world')
    await page.close()
  })

  it('client-fallback', async () => {
    const classes = [
      'clientfallback-non-stateful-setup',
      'clientfallback-non-stateful',
      'clientfallback-stateful-setup',
      'clientfallback-stateful',
      'clientfallback-async-setup',
    ]
    const html = await $fetch<string>('/client-fallback')
    // ensure failed components are not rendered server-side
    expect(html).not.toContain('This breaks in server-side setup.')
    classes.forEach(c => expect(html).not.toContain(c))
    // ensure not failed component not be rendered
    expect(html).not.toContain('Sugar Counter 12 x 0 = 0')
    // ensure NuxtClientFallback is being rendered with its fallback tag and attributes
    expect(html).toContain('<span class="break-in-ssr">this failed to render</span>')
    // ensure Fallback slot is being rendered server side
    expect(html).toContain('Hello world !')

    // ensure not failed component are correctly rendered
    expect(html).not.toContain('<p></p>')
    expect(html).toContain('hi')

    // async setup
    expect(html).toContain('Work with async setup')

    const { page, pageErrors } = await renderPage('/client-fallback')
    // ensure components reactivity once mounted
    await page.locator('#increment-count').click()
    expect(await page.locator('#sugar-counter').innerHTML()).toContain('Sugar Counter 12 x 1 = 12')
    // keep-fallback strategy
    expect(await page.locator('#keep-fallback').all()).toHaveLength(1)
    // #20833
    expect(await page.locator('body').innerHTML()).not.toContain('Hello world !')
    expect(pageErrors).toEqual([])
    await page.close()
  })

  it('/legacy-async-data-fail', async () => {
    const response = await fetch('/legacy-async-data-fail').then(r => r.text())
    expect(response).not.toContain('don\'t look at this')
    expect(response).toContain('OH NNNNNNOOOOOOOOOOO')
  })

  it('client only page', async () => {
    const response = await fetch('/client-only-page').then(r => r.text())

    // Should not contain rendered page on initial request
    expect(response).not.toContain('"hasAccessToWindow": true')
    expect(response).not.toContain('"isServer": false')

    const errors: string[] = []
    const { page: clientInitialPage } = await renderPage('/client-only-page')

    clientInitialPage.on('console', (message) => {
      const type = message.type()
      if (type === 'error' || type === 'warning') {
        errors.push(message.text())
      }
    })

    // But after hydration element should appear and contain this object
    expect(await clientInitialPage.locator('#state').textContent()).toMatchInlineSnapshot(`
      "{
        "hasAccessToWindow": true,
        "isServer": false
      }"
    `)

    expect(await clientInitialPage.locator('#server-rendered').textContent()).toMatchInlineSnapshot('"false"')

    // Then go to non client only page
    await clientInitialPage.click('a')
    await clientInitialPage.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/client-only-page/normal')

    // that page should be client rendered
    expect(await clientInitialPage.locator('#server-rendered').textContent()).toMatchInlineSnapshot('"false"')
    // and not contain any errors or warnings
    expect(errors.length).toBe(0)

    await clientInitialPage.close()
    errors.length = 0

    const { page: normalInitialPage } = await renderPage('/client-only-page/normal')

    normalInitialPage.on('console', (message) => {
      const type = message.type()
      if (type === 'error' || type === 'warning') {
        errors.push(message.text())
      }
    })

    // Now non client only page should be sever rendered
    expect(await normalInitialPage.locator('#server-rendered').textContent()).toMatchInlineSnapshot('"true"')

    // Go to client only page
    await normalInitialPage.click('a')

    await normalInitialPage.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/client-only-page')

    // and expect same object to be present
    expect(await normalInitialPage.locator('#state').textContent()).toMatchInlineSnapshot(`
      "{
        "hasAccessToWindow": true,
        "isServer": false
      }"
    `)

    // also there should not be any errors
    expect(errors.length).toBe(0)

    await normalInitialPage.close()
  })

  it('groups routes', async () => {
    for (const targetRoute of ['/group-page', '/nested-group/group-page', '/nested-group']) {
      const { status } = await fetch(targetRoute)

      expect(status).toBe(200)
    }
  })

  it.skipIf(isDev() || isWebpack /* TODO: fix bug with import.meta.prerender being undefined in webpack build */)('prerenders pages hinted with a route rule', async () => {
    const html = await $fetch('/prerender/test')
    expect(html).toContain('should be prerendered: true')
  })

  it('should trigger page:loading:end only once', async () => {
    const { page, consoleLogs } = await renderPage('/')

    await page.getByText('to page load hook').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/page-load-hook')
    const loadingEndLogs = consoleLogs.filter(c => c.text.includes('page:loading:end'))
    expect(loadingEndLogs.length).toBe(1)

    await page.close()
  })

  it('should hide nuxt page load indicator after navigate back from nested page', async () => {
    const LOAD_INDICATOR_SELECTOR = '.nuxt-loading-indicator'
    const { page } = await renderPage('/page-load-hook')
    await page.getByText('To sub page').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/page-load-hook/subpage')

    await page.waitForSelector(LOAD_INDICATOR_SELECTOR)
    let isVisible = await page.isVisible(LOAD_INDICATOR_SELECTOR)
    expect(isVisible).toBe(true)

    await page.waitForSelector(LOAD_INDICATOR_SELECTOR, { state: 'hidden' })
    isVisible = await page.isVisible(LOAD_INDICATOR_SELECTOR)
    expect(isVisible).toBe(false)

    await page.goBack()

    await page.waitForSelector(LOAD_INDICATOR_SELECTOR)
    isVisible = await page.isVisible(LOAD_INDICATOR_SELECTOR)
    expect(isVisible).toBe(true)

    await page.waitForSelector(LOAD_INDICATOR_SELECTOR, { state: 'hidden' })
    isVisible = await page.isVisible(LOAD_INDICATOR_SELECTOR)
    expect(isVisible).toBe(false)

    await page.close()
  })
})

describe('nuxt composables', () => {
  it('has useRequestURL()', async () => {
    const html = await $fetch<string>('/url')
    expect(html).toContain('path: /url')
  })
  it('sets cookies correctly', async () => {
    const res = await fetch('/cookies', {
      headers: {
        cookie: Object.entries({
          'browser-accessed-but-not-used': 'provided-by-browser',
          'browser-accessed-with-default-value': 'provided-by-browser',
          'browser-set': 'provided-by-browser',
          'browser-set-to-null': 'provided-by-browser',
          'browser-set-to-null-with-default': 'provided-by-browser',
        }).map(([key, value]) => `${key}=${value}`).join('; '),
      },
    })
    const cookies = res.headers.get('set-cookie')
    expect(cookies).toMatchInlineSnapshot('"set-in-plugin=true; Path=/, accessed-with-default-value=default; Path=/, set=set; Path=/, browser-set=set; Path=/, browser-set-to-null=; Max-Age=0; Path=/, browser-set-to-null-with-default=; Max-Age=0; Path=/, browser-object-default=%7B%22foo%22%3A%22bar%22%7D; Path=/, theCookie=show; Path=/"')
  })
  it('updates cookies when they are changed', async () => {
    const { page } = await renderPage('/cookies')
    async function extractCookie () {
      const cookie = await page.evaluate(() => document.cookie)
      const raw = cookie.match(/browser-object-default=([^;]*)/)![1] ?? 'null'
      return JSON.parse(decodeURIComponent(raw))
    }
    expect(await extractCookie()).toEqual({ foo: 'bar' })
    await page.getByText('Change cookie').click()
    expect(await extractCookie()).toEqual({ foo: 'baz' })
    let text = await page.innerText('pre')
    expect(text).toContain('baz')
    await page.getByText('Change cookie').click()
    expect(await extractCookie()).toEqual({ foo: 'bar' })
    await page.evaluate(() => { document.cookie = `browser-object-default=${encodeURIComponent('{"foo":"foobar"}')}` })
    await page.getByText('Refresh cookie').click()
    text = await page.innerText('pre')
    expect(text).toContain('foobar')
    await page.close()
  })

  it('sets cookies in composable to null in all components', async () => {
    const { page } = await renderPage('/cookies')
    const parentBannerText = await page.locator('#parent-banner').textContent()
    expect(parentBannerText).toContain('parent banner')

    const childBannerText = await page.locator('#child-banner').innerText()
    expect(childBannerText).toContain('child banner')

    // Clear the composable cookie
    await page.getByText('Toggle cookie banner').click()
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

    const parentBannerAfterToggle = await page.locator('#parent-banner').isVisible()
    expect(parentBannerAfterToggle).toBe(false)

    const childBannerAfterToggle = await page.locator('#child-banner').isVisible()
    expect(childBannerAfterToggle).toBe(false)
    await page.close()
  })

  it('supports onPrehydrate', async () => {
    const html = await $fetch<string>('/composables/on-prehydrate') as string
    /**
     * Should look something like this:
     *
     * ```html
     * <div data-prehydrate-id=":b3qlvSiBeH::df1mQEC9xH:"> onPrehydrate testing </div>
     * <script>(()=>{console.log(window)})()</script>
     * <script>document.querySelectorAll('[data-prehydrate-id*=":b3qlvSiBeH:"]').forEach(o=>{console.log(o.outerHTML)})</script>
     * <script>document.querySelectorAll('[data-prehydrate-id*=":df1mQEC9xH:"]').forEach(o=>{console.log("other",o.outerHTML)})</script>
     * ```
     */
    const { id1, id2 } = html.match(/<div[^>]* data-prehydrate-id=":(?<id1>[^:]+)::(?<id2>[^:]+):"> onPrehydrate testing <\/div>/)?.groups || {}
    expect(id1).toBeTruthy()
    const matches = [
      html.match(/<script[^>]*>\(\(\)=>\{console.log\(window\)\}\)\(\)<\/script>/),
      html.match(new RegExp(`<script[^>]*>document.querySelectorAll\\('\\[data-prehydrate-id\\*=":${id1}:"]'\\).forEach\\(o=>{console.log\\(o.outerHTML\\)}\\)</script>`, 'i')),
      html.match(new RegExp(`<script[^>]*>document.querySelectorAll\\('\\[data-prehydrate-id\\*=":${id2}:"]'\\).forEach\\(o=>{console.log\\("other",o.outerHTML\\)}\\)</script>`, 'i')),
    ]

    // This tests we inject all scripts correctly, and only have one occurrence of multiple calls of a composable
    expect(matches.every(s => s?.length === 1)).toBeTruthy()

    // Check for hydration/syntax errors on client side
    await expectNoClientErrors('/composables/on-prehydrate')
  })

  it('respects preview mode with a token', async () => {
    const token = 'hehe'
    const page = await createPage(`/preview?preview=true&token=${token}`)

    const hasRerunFetchOnClient = await new Promise<boolean>((resolve) => {
      page.on('console', (message) => {
        setTimeout(() => resolve(false), 4000)

        if (message.text() === 'true') { resolve(true) }
      })
    })

    expect(hasRerunFetchOnClient).toBe(true)

    expect(await page.locator('#fetched-on-client').textContent()).toContain('fetched on client')
    expect(await page.locator('#preview-mode').textContent()).toContain('preview mode enabled')

    await page.click('#use-fetch-check')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath.includes('/preview/with-use-fetch'))

    expect(await page.locator('#token-check').textContent()).toContain(token)
    expect(await page.locator('#correct-api-key-check').textContent()).toContain('true')
    await page.close()
  })

  it('respects preview mode with custom state', async () => {
    const { page } = await renderPage('/preview/with-custom-state?preview=true')

    expect(await page.locator('#data1').textContent()).toContain('data1 updated')
    expect(await page.locator('#data2').textContent()).toContain('data2')

    await page.click('#toggle-preview') // manually turns off preview mode
    await page.click('#with-use-fetch')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath.includes('/preview/with-use-fetch'))

    expect(await page.locator('#enabled').textContent()).toContain('false')
    expect(await page.locator('#token-check').textContent()).toEqual('')
    expect(await page.locator('#correct-api-key-check').textContent()).toContain('false')
    await page.close()
  })

  it('respects preview mode with custom enable', async () => {
    const { page } = await renderPage('/preview/with-custom-enable?preview=true')

    expect(await page.locator('#enabled').textContent()).toContain('false')
    await page.close()
  })

  it('respects preview mode with custom enable and customPreview', async () => {
    const { page } = await renderPage('/preview/with-custom-enable?customPreview=true')

    expect(await page.locator('#enabled').textContent()).toContain('true')
    await page.close()
  })
})

describe('rich payloads', () => {
  it('correctly serializes and revivifies complex types', async () => {
    const html = await $fetch<string>('/json-payload')
    for (const test of [
      'Date: true',
      'BigInt: true',
      'Error: true',
      'Shallow reactive: true',
      'Shallow ref: true',
      'Undefined ref: true',
      'BigInt ref:',
      'Reactive: true',
      'Ref: true',
      'Recursive objects: true',
    ]) {
      expect(html).toContain(test)
    }
  })
})

describe('nuxt links', () => {
  it('handles trailing slashes', async () => {
    const html = await $fetch<string>('/nuxt-link/trailing-slash')
    const data: Record<string, string[]> = {}
    for (const selector of ['nuxt-link', 'router-link', 'link-with-trailing-slash', 'link-without-trailing-slash']) {
      data[selector] = []
      for (const match of html.matchAll(new RegExp(`href="([^"]*)"[^>]*class="[^"]*\\b${selector}\\b`, 'g'))) {
        data[selector]!.push(match[1]!)
      }
    }
    expect(data).toMatchInlineSnapshot(`
      {
        "link-with-trailing-slash": [
          "/",
          "/nuxt-link/trailing-slash/",
          "/nuxt-link/trailing-slash/",
          "/nuxt-link/trailing-slash/?test=true&amp;thing=other/thing#thing-other",
          "/nuxt-link/trailing-slash/?test=true&amp;thing=other/thing#thing-other",
          "/nuxt-link/trailing-slash/",
          "/nuxt-link/trailing-slash/?with-state=true",
          "/nuxt-link/trailing-slash/?without-state=true",
        ],
        "link-without-trailing-slash": [
          "/",
          "/nuxt-link/trailing-slash",
          "/nuxt-link/trailing-slash",
          "/nuxt-link/trailing-slash?test=true&amp;thing=other/thing#thing-other",
          "/nuxt-link/trailing-slash?test=true&amp;thing=other/thing#thing-other",
          "/nuxt-link/trailing-slash",
          "/nuxt-link/trailing-slash?with-state=true",
          "/nuxt-link/trailing-slash?without-state=true",
        ],
        "nuxt-link": [
          "/",
          "/nuxt-link/trailing-slash",
          "/nuxt-link/trailing-slash/",
          "/nuxt-link/trailing-slash?test=true&amp;thing=other/thing#thing-other",
          "/nuxt-link/trailing-slash/?test=true&amp;thing=other/thing#thing-other",
          "/nuxt-link/trailing-slash",
          "/nuxt-link/trailing-slash?with-state=true",
          "/nuxt-link/trailing-slash?without-state=true",
        ],
        "router-link": [
          "/",
          "/nuxt-link/trailing-slash",
          "/nuxt-link/trailing-slash/",
          "/nuxt-link/trailing-slash?test=true&amp;thing=other/thing#thing-other",
          "/nuxt-link/trailing-slash/?test=true&amp;thing=other/thing#thing-other",
          "/nuxt-link/trailing-slash",
          "/nuxt-link/trailing-slash?with-state=true",
          "/nuxt-link/trailing-slash?without-state=true",
        ],
      }
    `)
  })

  it('respects external links in edge cases', async () => {
    const html = await $fetch<string>('/nuxt-link/custom-external')
    const hrefs = html.match(/<a[^>]*href="([^"]+)"/g)
    expect(hrefs).toMatchInlineSnapshot(`
      [
        "<a href="https://thehackernews.com/2024/01/urgent-upgrade-gitlab-critical.html"",
        "<a href="https://thehackernews.com/2024/01/urgent-upgrade-gitlab-critical.html"",
        "<a href="/missing-page/"",
        "<a href="/missing-page/"",
      ]
    `)

    const { page, consoleLogs } = await renderPage('/nuxt-link/custom-external')
    const warnings = consoleLogs.filter(c => c.text.includes('No match found for location'))
    expect(warnings).toMatchInlineSnapshot(`[]`)
    await page.close()
  })

  it('preserves route state', async () => {
    const { page } = await renderPage('/nuxt-link/trailing-slash')

    for (const selector of ['nuxt-link', 'router-link', 'link-with-trailing-slash', 'link-without-trailing-slash']) {
      await page.locator(`.${selector}[href*=with-state]`).click()
      await page.getByTestId('window-state').getByText('bar').waitFor()

      await page.locator(`.${selector}[href*=without-state]`).click()
      await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath.includes('without-state'))
      expect(await page.getByTestId('window-state').innerText()).not.toContain('bar')
    }

    await page.close()
  })

  it('expect scroll to top on routes with same component', async () => {
    // #22402
    const page = await createPage('/big-page-1', {
      viewport: {
        width: 1000,
        height: 1000,
      },
    })
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/big-page-1')

    await page.locator('#big-page-2').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)
    await page.locator('#big-page-2').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/big-page-2')
    await page.waitForFunction(() => window.scrollY === 0)

    await page.locator('#big-page-1').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)
    await page.locator('#big-page-1').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/big-page-1')
    await page.waitForFunction(() => window.scrollY === 0)
    await page.close()
  })

  it('expect scroll to top on nested pages', async () => {
    // #20523
    const page = await createPage('/nested/foo/test', {
      viewport: {
        width: 1000,
        height: 1000,
      },
    })
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nested/foo/test')

    await page.locator('#user-test').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)
    await page.locator('#user-test').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nested/foo/user-test')
    await page.waitForFunction(() => window.scrollY === 0)

    await page.locator('#test').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)
    await page.locator('#test').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nested/foo/test')
    await page.waitForFunction(() => window.scrollY === 0)
    await page.close()
  })

  it('useLink works', async () => {
    const html = await $fetch<string>('/nuxt-link/use-link')
    expect(html).toContain('<div>useLink in NuxtLink: true</div>')
    expect(html).toContain('<div>route using useLink: /nuxt-link/trailing-slash</div>')
    expect(html).toContain('<div>href using useLink: /nuxt-link/trailing-slash</div>')
    expect(html).toContain('<div>useLink2 in NuxtLink: true</div>')
    expect(html).toContain('<div>route2 using useLink: /nuxt-link/trailing-slash</div>')
    expect(html).toContain('<div>href2 using useLink: /nuxt-link/trailing-slash</div>')
    expect(html).toContain('<div>useLink3 in NuxtLink: true</div>')
    expect(html).toContain('<div>route3 using useLink: /nuxt-link/trailing-slash</div>')
    expect(html).toContain('<div>href3 using useLink: /nuxt-link/trailing-slash</div>')
  })
  it('useLink navigate importing NuxtLink works', async () => {
    const page = await createPage('/nuxt-link/use-link')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/nuxt-link/use-link')

    await page.locator('#button1').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nuxt-link/trailing-slash')
    await page.close()
  })
  it('useLink navigate using resolveComponent works', async () => {
    const page = await createPage('/nuxt-link/use-link')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/nuxt-link/use-link')

    await page.locator('#button2').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nuxt-link/trailing-slash')
    await page.close()
  })
  it('useLink navigate using resolveDynamicComponent works', async () => {
    const page = await createPage('/nuxt-link/use-link')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/nuxt-link/use-link')

    await page.locator('#button3').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nuxt-link/trailing-slash')
    await page.close()
  })
})

describe('head tags', () => {
  it('SSR should render tags', async () => {
    const headHtml = await $fetch<string>('/head')

    expect(headHtml).toContain('<title>Using a dynamic component - Title Template Fn Change</title>')
    expect(headHtml).not.toContain('<meta name="description" content="first">')
    expect(headHtml).toContain('<meta charset="utf-16">')
    expect(headHtml.match('meta charset')!.length).toEqual(1)
    expect(headHtml).toContain('<meta name="viewport" content="width=1024, initial-scale=1">')
    expect(headHtml.match('meta name="viewport"')!.length).toEqual(1)
    expect(headHtml).not.toContain('<meta charset="utf-8">')
    expect(headHtml).toContain('<meta name="description" content="overriding with an inline useHead call">')
    expect(headHtml).toMatch(/<html[^>]*class="html-attrs-test"/)
    expect(headHtml).toMatch(/<body[^>]*class="body-attrs-test"/)

    const bodyHtml = headHtml.match(/<body[^>]*>(.*)<\/body>/s)![1]
    expect(bodyHtml).toContain('<script src="https://a-body-appended-script.com"></script>')

    const indexHtml = await $fetch<string>('/')
    // should render charset by default
    expect(indexHtml).toContain('<meta charset="utf-8">')
    // should render <Head> components
    expect(indexHtml).toContain('<title>Basic fixture - Fixture</title>')
  })

  it('SSR script setup should render tags', async () => {
    const headHtml = await $fetch<string>('/head-script-setup')

    // useHead - title & titleTemplate are working
    expect(headHtml).toContain('<title>head script setup - Nuxt Playground</title>')
    // useSeoMeta - template params
    expect(headHtml).toContain('<meta property="og:title" content="head script setup - Nuxt Playground">')
    // useSeoMeta - refs
    expect(headHtml).toContain('<meta name="description" content="head script setup description for Nuxt Playground">')
    // useServerHead - shorthands
    expect(headHtml).toContain('>/* Custom styles */</style>')
    // useHeadSafe - removes dangerous content
    expect(headHtml).not.toContain('<script id="xss-script">')
    expect(headHtml).toContain('<meta content="0;javascript:alert(1)">')
  })

  it('SPA should render appHead tags', async () => {
    const headHtml = await $fetch<string>('/head-spa')

    expect(headHtml).toContain('<meta name="description" content="Nuxt Fixture">')
    expect(headHtml).toContain('<meta charset="utf-8">')
    expect(headHtml).toContain('<meta name="viewport" content="width=1024, initial-scale=1">')
  })

  it('should render http-equiv correctly', async () => {
    const html = await $fetch<string>('/head')
    // http-equiv should be rendered kebab case
    expect(html).toContain('<meta http-equiv="content-security-policy" content="default-src https">')
  })

  // TODO: Doesn't adds header in test environment
  // it.todo('should render stylesheet link tag (SPA mode)', async () => {
  //   const html = await $fetch<string>('/head', { headers: { 'x-nuxt-no-ssr': '1' } })
  //   expect(html).toMatch(/<link rel="stylesheet" href="\/_nuxt\/[^>]*.css"/)
  // })
})

describe('legacy async data', () => {
  it('should work with defineNuxtComponent', async () => {
    const html = await $fetch<string>('/legacy/async-data')
    expect(html).toContain('<div>Hello API</div>')
    expect(html).toContain('<div>fooChild</div>')
    expect(html).toContain('<div>fooParent</div>')
    const { script } = parseData(html)
    expect(script.data['options:asyncdata:hello'].hello).toBe('Hello API')
    expect(Object.values(script.data)).toMatchInlineSnapshot(`
      [
        {
          "baz": "qux",
          "foo": "bar",
        },
        {
          "hello": "Hello API",
        },
        {
          "fooParent": "fooParent",
        },
        {
          "fooChild": "fooChild",
        },
      ]
    `)
  })
})

describe('navigate', () => {
  it('should redirect to index with navigateTo', async () => {
    const { headers, status } = await fetch('/navigate-to/', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/')
    expect(status).toEqual(301)
  })

  it('respects redirects + headers in middleware', async () => {
    const res = await fetch('/navigate-some-path/', { redirect: 'manual', headers: { 'trailing-slash': 'true' } })
    expect(res.headers.get('location')).toEqual('/navigate-some-path')
    expect(res.status).toEqual(307)
    expect(await res.text()).toMatchInlineSnapshot('"<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/navigate-some-path"></head></html>"')
  })

  it('should not overwrite headers', async () => {
    const { headers, status } = await fetch('/navigate-to-external', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/')
    expect(status).toEqual(302)
  })

  it('should not run setup function in path redirected to', async () => {
    const { headers, status } = await fetch('/navigate-to-error', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/setup-should-not-run')
    expect(status).toEqual(302)
  })

  it('supports directly aborting navigation on SSR', async () => {
    const { status } = await fetch('/navigate-to-false', { redirect: 'manual' })

    expect(status).toEqual(404)
  })

  it('expect to redirect with encoding', async () => {
    const { status, headers } = await fetch('/redirect-with-encode', { redirect: 'manual' })

    expect(status).toEqual(302)
    expect(headers.get('location') || '').toEqual(encodeURI('/cœur') + '?redirected=' + encodeURIComponent('https://google.com'))
  })
})

describe('preserves current instance', () => {
  // TODO: it's unclear why there's an error here but it must be an upstream issue
  it.todo('should not return getCurrentInstance when there\'s an error in data', async () => {
    await fetch('/instance/error')
    const html = await $fetch<string>('/instance/next-request')
    expect(html).toContain('This should be false: false')
  })
  // TODO: re-enable when https://github.com/nuxt/nuxt/issues/15164 is resolved
  it.skipIf(isWindows)('should not lose current nuxt app after await in vue component', async () => {
    const requests = await Promise.all(Array.from({ length: 100 }).map(() => $fetch<string>('/instance/next-request')))
    for (const html of requests) {
      expect(html).toContain('This should be true: true')
    }
  })
})

describe('errors', () => {
  it('should render a JSON error page', async () => {
    const res = await fetch('/error', {
      headers: {
        accept: 'application/json',
      },
    })
    expect(res.status).toBe(422)
    expect(res.statusText).toBe('This is a custom error')
    const error = await res.json()
    delete error.stack
    const url = new URL(error.url)
    url.host = 'localhost:3000'
    error.url = url.toString()
    expect(error).toMatchObject({
      message: isDev() ? 'This is a custom error' : 'Server Error',
      statusCode: 422,
      statusMessage: 'This is a custom error',
      url: 'http://localhost:3000/error',
    })
  })

  it('should render a HTML error page', async () => {
    const res = await fetch('/error')
    expect(res.headers.get('Set-Cookie')).toBe('set-in-plugin=true; Path=/, some-error=was%20set; Path=/')
    expect(await res.text()).toContain('This is a custom error')
  })

  it('should not allow accessing error route directly', async () => {
    const res = await fetch('/__nuxt_error', {
      headers: {
        accept: 'application/json',
      },
    })
    expect(res.status).toBe(404)
    const error = await res.json()
    delete error.stack
    const url = new URL(error.url)
    url.host = 'localhost:3000'
    error.url = url.toString()

    expect(error).toMatchInlineSnapshot(`
      {
        "error": true,
        "message": "Page Not Found: /__nuxt_error",
        "statusCode": 404,
        "statusMessage": "Page Not Found: /__nuxt_error",
        "url": "http://localhost:3000/__nuxt_error",
      }
    `)
  })

  it('should not recursively throw an error when there is an error rendering the error page', async () => {
    const res = await $fetch<string>('/', {
      headers: {
        'x-test-recurse-error': 'true',
        'accept': 'text/html',
      },
    })
    expect(typeof res).toBe('string')
    expect(res).toContain('Hello Nuxt 3!')
  })

  // TODO: need to create test for webpack
  it.runIf(!isDev())('should handle chunk loading errors', async () => {
    const { page, consoleLogs } = await renderPage()
    await page.route(/\.css/, route => route.abort('timedout')) // verify CSS link preload failure doesn't break the page
    await page.goto(url('/'))
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/' && !window.useNuxtApp?.().isHydrating)

    const initialLogs = consoleLogs.map(c => c.text).join('')
    expect(initialLogs).toContain('caught chunk load error')
    consoleLogs.length = 0

    await page.getByText('Increment state').click()
    await page.getByText('Increment state').click()
    expect(await page.innerText('div')).toContain('Some value: 3')
    await page.route(/.*/, route => route.abort('timedout'), { times: 1 })
    await page.getByText('Chunk error').click()

    await page.waitForURL(url('/chunk-error'))

    const logs = consoleLogs.map(c => c.text).join('')
    expect(logs).toContain('caught chunk load error')
    expect(logs).toContain('Failed to load resource')

    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/chunk-error')
    expect(await page.innerText('div')).toContain('Chunk error page')
    await page.locator('div').getByText('State: 3').waitFor()

    await page.close()
  })

  it('should allow catching errors within error boundaries', async () => {
    const { page } = await renderPage('/error/error-boundary')
    await page.getByText('This is the error rendering')
    await page.close()

    await expectNoClientErrors('/error/error-boundary')
  })
})

describe('navigate external', () => {
  it('should redirect to example.com', async () => {
    const { headers } = await fetch('/navigate-to-external/', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('https://example.com/?redirect=false#test')
  })

  it('should redirect to api endpoint', async () => {
    const { headers } = await fetch('/navigate-to-api', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/api/test')
  })
})

describe('composables', () => {
  it('`callOnce` should run code once', async () => {
    const html = await $fetch<string>('/once')

    expect(html).toContain('once.vue')
    expect(html).toContain('once: 2')

    const { page } = await renderPage('/once')
    expect(await page.getByText('once:').textContent()).toContain('once: 2')
  })
  it('`callOnce` should run code once with navigation mode during initial render', async () => {
    const html = await $fetch<string>('/once-nav-initial')

    expect(html).toContain('once.vue')
    expect(html).toContain('once: 2')

    const { page } = await renderPage('/once-nav-initial')
    expect(await page.getByText('once:').textContent()).toContain('once: 2')
  })
  it('`useId` should generate unique ids', async () => {
    // TODO: work around interesting Vue bug where async components are loaded in a different order on first import
    await $fetch<string>('/use-id')

    const sanitiseHTML = (html: string) => html.replace(/ data-[^= ]+="[^"]+"/g, '').replace(/<!--[[\]]-->/, '')

    const serverHTML = await $fetch<string>('/use-id').then(html => sanitiseHTML(html.match(/<form.*<\/form>/)![0]))
    const ids = serverHTML.match(/id="[^"]*"/g)?.map(id => id.replace(/id="([^"]*)"/, '$1')) as string[]
    const renderedForm = [
      `<h2 id="${ids[0]}"> id: ${ids[0]}</h2><div><label for="${ids[1]}">Email</label><input id="${ids[1]}" name="email" type="email"><label for="${ids[2]}">Password</label><input id="${ids[2]}" name="password" type="password"></div>`,
      `<div><label for="${ids[3]}">Email</label><input id="${ids[3]}" name="email" type="email"><label for="${ids[4]}">Password</label><input id="${ids[4]}" name="password" type="password"></div>`,
    ]
    const clientOnlyServer = '<span></span>'
    expect(serverHTML).toEqual(`<form>${renderedForm.join(clientOnlyServer)}</form>`)

    const { page, pageErrors } = await renderPage('/use-id')
    const clientHTML = await page.innerHTML('form')
    const clientIds = clientHTML
      .match(/id="[^"]*"/g)?.map(id => id.replace(/id="([^"]*)"/, '$1'))
      .filter(i => !ids.includes(i)) as string[]
    const clientOnlyClient = `<div><label for="${clientIds[0]}">Email</label><input id="${clientIds[0]}" name="email" type="email"><label for="${clientIds[1]}">Password</label><input id="${clientIds[1]}" name="password" type="password"></div>`
    expect(sanitiseHTML(clientHTML)).toEqual(`${renderedForm.join(clientOnlyClient)}`)
    expect(pageErrors).toEqual([])
    await page.close()
  })
  it('`useRouteAnnouncer` should change message on route change', async () => {
    const { page } = await renderPage('/route-announcer')
    expect(await page.getByRole('alert').textContent()).toContain('First Page')
    await page.getByRole('link').click()
    await page.getByText('Second page content').waitFor()
    expect(await page.getByRole('alert').textContent()).toContain('Second Page')
    await page.close()
  })
  it('`useRouteAnnouncer` should change message on dynamically changed title', async () => {
    const { page } = await renderPage('/route-announcer')
    await page.getByRole('button').click()
    await page.waitForFunction(() => document.title.includes('Dynamically set title'))
    expect(await page.getByRole('alert').textContent()).toContain('Dynamically set title')
    await page.close()
  })
})

describe('middlewares', () => {
  it('should redirect to index with global middleware', async () => {
    const html = await $fetch<string>('/redirect/')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('Hello Nuxt 3!')
  })

  it('should allow redirection from a non-existent route with `ssr: false`', async () => {
    const page = await createPage('/redirect/catchall')

    expect(await page.getByRole('heading').textContent()).toMatchInlineSnapshot('"[...slug].vue"')
    await page.close()
  })

  it('should allow aborting navigation on server-side', async () => {
    const res = await fetch('/?abort', {
      headers: {
        accept: 'application/json',
      },
    })
    expect(res.status).toEqual(401)
  })

  it('should allow aborting navigation fatally on client-side', async () => {
    const html = await $fetch<string>('/middleware-abort')
    expect(html).not.toContain('This is the error page')
    const { page } = await renderPage('/middleware-abort')
    expect(await page.innerHTML('body')).toContain('This is the error page')
    await page.close()
  })

  it('should inject auth', async () => {
    const html = await $fetch<string>('/auth')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('auth.vue')
    expect(html).toContain('auth: Injected by injectAuth middleware')
  })

  it('should not inject auth', async () => {
    const html = await $fetch<string>('/no-auth')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('no-auth.vue')
    expect(html).toContain('auth: ')
    expect(html).not.toContain('Injected by injectAuth middleware')
  })

  it('should redirect to index with http 307 with navigateTo on server side', async () => {
    const html = await fetch('/navigate-to-redirect', { redirect: 'manual' })
    expect(html.headers.get('location')).toEqual('/')
    expect(html.status).toEqual(307)
  })
})

describe('plugins', () => {
  it('basic plugin', async () => {
    const html = await $fetch<string>('/plugins')
    expect(html).toContain('myPlugin: Injected by my-plugin')
  })

  it('async plugin', async () => {
    const html = await $fetch<string>('/plugins')
    expect(html).toContain('asyncPlugin: Async plugin works! 123')
    expect(html).toContain('useFetch works!')
  })
})

describe('layouts', () => {
  it('should apply custom layout', async () => {
    const html = await $fetch<string>('/with-layout')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('with-layout.vue')
    expect(html).toContain('Custom Layout:')
  })
  it('should work with a dynamically set layout', async () => {
    const html = await $fetch<string>('/with-dynamic-layout')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('with-dynamic-layout')
    expect(html).toContain('Custom Layout:')
    await expectNoClientErrors('/with-dynamic-layout')
  })
  it('should work with a computed layout', async () => {
    const html = await $fetch<string>('/with-computed-layout')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('with-computed-layout')
    expect(html).toContain('Custom Layout')
    await expectNoClientErrors('/with-computed-layout')
  })
  it('should allow passing custom props to a layout', async () => {
    const html = await $fetch<string>('/layouts/with-props')
    expect(html).toContain('some prop was passed')
    await expectNoClientErrors('/layouts/with-props')
  })
})

describe('composable tree shaking', () => {
  it('should work', async () => {
    const html = await $fetch<string>('/tree-shake')

    expect(html).toContain('Tree Shake Example')

    const { page, pageErrors } = await renderPage('/tree-shake')
    // ensure scoped classes are correctly assigned between client and server
    expect(await page.$eval('h1', e => getComputedStyle(e).color)).toBe('rgb(255, 192, 203)')

    expect(pageErrors).toEqual([])

    await page.close()
  })
})

describe('ignore list', () => {
  it('should ignore composable files in .nuxtignore', async () => {
    const html = await $fetch<string>('/ignore/composables')
    expect(html).toContain('was import ignored: true')
  })
  it('should ignore scanned nitro handlers in .nuxtignore', async () => {
    const { status } = await fetch('/ignore/scanned')
    expect(status).toBe(404)
  })
  it.skipIf(isDev())('should ignore public assets in .nuxtignore', async () => {
    const { status } = await fetch('/ignore/public-asset')
    expect(status).toBe(404)
  })
})

describe('server tree shaking', () => {
  it('should work', async () => {
    const html = await $fetch<string>('/client')

    expect(html).toContain('This page should not crash when rendered')
    expect(html).toContain('fallback for ClientOnly')
    expect(html).not.toContain('rendered client-side')
    expect(html).not.toContain('id="client-side"')

    const { page } = await renderPage('/client')
    await page.waitForFunction(() => window.useNuxtApp?.())
    // ensure scoped classes are correctly assigned between client and server
    expect(await page.$eval('.red', e => getComputedStyle(e).color)).toBe('rgb(255, 0, 0)')
    expect(await page.$eval('.blue', e => getComputedStyle(e).color)).toBe('rgb(0, 0, 255)')
    expect(await page.locator('#client-side').textContent()).toContain('This should be rendered client-side')

    await page.close()
  })
})

describe('extends support', () => {
  describe('layouts & pages', () => {
    it('extends foo/layouts/default & foo/pages/index', async () => {
      const html = await $fetch<string>('/foo')
      expect(html).toContain('Extended layout from foo')
      expect(html).toContain('Extended page from foo')
    })

    it('extends [bar/layouts/override & bar/pages/override] over [foo/layouts/override & foo/pages/override]', async () => {
      const html = await $fetch<string>('/override')
      expect(html).toContain('Extended layout from bar')
      expect(html).toContain('Extended page from bar')
      expect(html).toContain('This child page should not be overridden by bar')
    })
  })

  describe('components', () => {
    it('extends foo/components/ExtendsFoo', async () => {
      const html = await $fetch<string>('/foo')
      expect(html).toContain('Extended component from foo')
    })

    it('extends bar/components/ExtendsOverride over foo/components/ExtendsOverride', async () => {
      const html = await $fetch<string>('/override')
      expect(html).toContain('Extended component from bar')
    })
  })

  describe('middlewares', () => {
    it('works with layer aliases', async () => {
      const html = await $fetch<string>('/foo')
      expect(html).toContain('from layer alias')
    })
    it('extends foo/middleware/foo', async () => {
      const html = await $fetch<string>('/foo')
      expect(html).toContain('Middleware | foo: Injected by extended middleware from foo')
    })

    it('extends bar/middleware/override over foo/middleware/override', async () => {
      const html = await $fetch<string>('/override')
      expect(html).toContain('Middleware | override: Injected by extended middleware from bar')
    })
    it('global middlewares sorting', async () => {
      const html = await $fetch<string>('/catchall/middleware/ordering')
      expect(html).toContain('catchall at middleware')
    })
  })

  describe('composables', () => {
    it('extends foo/composables/foo', async () => {
      const html = await $fetch<string>('/foo')
      expect(html).toContain('Composable | useExtendsFoo: foo')
    })
    it('allows overriding composables', async () => {
      const html = await $fetch<string>('/extends')
      expect(html).toContain('test from project')
    })
  })

  describe('plugins', () => {
    it('extends foo/plugins/foo', async () => {
      const html = await $fetch<string>('/foo')
      expect(html).toContain('Plugin | foo: String generated from foo plugin!')
    })

    it('respects plugin ordering within layers', async () => {
      const html = await $fetch<string>('/catchall/plugins/ordering')
      expect(html).toContain('catchall at plugins')
    })
  })

  describe('server', () => {
    it('extends foo/server/api/foo', async () => {
      expect(await $fetch<string>('/api/foo')).toBe('foo')
    })

    it('extends foo/server/middleware/foo', async () => {
      const { headers } = await fetch('/')
      expect(headers.get('injected-header')).toEqual('foo')
    })
  })

  describe('app', () => {
    it('extends foo/app/router.options & bar/app/router.options', async () => {
      const html: string = await $fetch<string>('/')
      const routerLinkClasses = html.match(/href="\/" class="([^"]*)"/)![1]!.split(' ')
      expect(routerLinkClasses).toContain('foo-active-class')
      expect(routerLinkClasses).toContain('bar-exact-active-class')
    })
  })
})

// Bug #7337
describe('deferred app suspense resolve', () => {
  it.each(['/async-parent/child', '/internal-layout/async-parent/child'])('should wait for all suspense instance on initial hydration', async (path) => {
    const { page, consoleLogs } = await renderPage(path)

    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)
    // Wait for all pending micro ticks to be cleared in case hydration hasn't finished yet.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

    const hydrationLogs = consoleLogs.filter(log => log.text.includes('isHydrating'))
    expect(hydrationLogs.length).toBe(3)
    expect(hydrationLogs.every(log => log.text === 'isHydrating: true'))

    await page.close()
  })

  it('should wait for suspense in parent layout', async () => {
    const { page } = await renderPage('/hydration/layout')
    await page.getByText('Tests whether hydration is properly resolved within an async layout').waitFor()
    await page.close()
  })

  it('should fully hydrate even if there is a redirection on a page with `ssr: false`', async () => {
    const { page } = await renderPage()
    await page.goto(url('/hydration/spa-redirection/start'))
    await page.getByText('fully hydrated and ready to go').waitFor()
    await page.close()
  })
})

describe('nested suspense', () => {
  const navigations = ([
    ['/suspense/sync-1/async-1/', '/suspense/sync-2/async-1/'],
    ['/suspense/sync-1/sync-1/', '/suspense/sync-2/async-1/'],
    ['/suspense/async-1/async-1/', '/suspense/async-2/async-1/'],
    ['/suspense/async-1/sync-1/', '/suspense/async-2/async-1/'],
  ] as const).flatMap(([start, end]) => [
    [start, end],
    [start, end + '?layout=custom'],
    [start + '?layout=custom', end],
  ])

  it.each(navigations)('should navigate from %s to %s with no white flash', async (start, nav) => {
    const { page, consoleLogs } = await renderPage(start)

    const slug = nav.replace(/\?.*$/, '').replace(/[/-]+/g, '-')
    await page.click(`[href^="${nav}"]`)

    const text = await page.waitForFunction(slug => document.querySelector(`main:has(#child${slug})`)?.innerHTML, slug)
      .then(r => r.evaluate(r => r))

    // expect(text).toMatchInlineSnapshot()

    // const parent = await page.waitForSelector(`#${slug}`, { state: 'attached' })

    // const text = await parent.innerText()
    expect(text).toContain('Async child: 2 - 1')
    expect(text).toContain('parent: 2')

    const first = start.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\/(?<childType>a?sync)-(?<childNum>\d)\//)!.groups!
    const last = nav.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\/(?<childType>a?sync)-(?<childNum>\d)\//)!.groups!

    expect(consoleLogs.map(l => l.text).filter(i => !i.includes('[vite]') && !i.includes('<Suspense> is an experimental feature')).sort()).toEqual([
      // [first load] from parent
      `[${first.parentType}]`,
      ...first.parentType === 'async' ? ['[async] running async data'] : [],
      // [first load] from child
      `[${first.parentType}] [${first.childType}]`,
      ...first.childType === 'async' ? [`[${first.parentType}] [${first.parentNum}] [async] [${first.childNum}] running async data`] : [],
      // [navigation] from parent
      `[${last.parentType}]`,
      ...last.parentType === 'async' ? ['[async] running async data'] : [],
      // [navigation] from child
      `[${last.parentType}] [${last.childType}]`,
      ...last.childType === 'async' ? [`[${last.parentType}] [${last.parentNum}] [async] [${last.childNum}] running async data`] : [],
    ].sort())

    await page.close()
  })

  const outwardNavigations = [
    ['/suspense/async-2/async-1/', '/suspense/async-1/'],
    ['/suspense/async-2/sync-1/', '/suspense/async-1/'],
  ]

  it.each(outwardNavigations)('should navigate from %s to a parent %s with no white flash', async (start, nav) => {
    const { page, consoleLogs } = await renderPage(start)

    await page.waitForSelector(`main:has(#child${start.replace(/[/-]+/g, '-')})`)

    const slug = start.replace(/[/-]+/g, '-')
    await page.click(`[href^="${nav}"]`)

    // wait until child selector disappears and grab HTML of parent
    const text = await page.waitForFunction(slug => document.querySelector(`main:not(:has(#child${slug}))`)?.innerHTML, slug)
      .then(r => r.evaluate(r => r))

    expect(text).toContain('Async parent: 1')

    const first = start.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\/(?<childType>a?sync)-(?<childNum>\d)\//)!.groups!
    const last = nav.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\//)!.groups!

    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, nav)

    expect(consoleLogs.map(l => l.text).filter(i => !i.includes('[vite]') && !i.includes('<Suspense> is an experimental feature')).sort()).toEqual([
      // [first load] from parent
      `[${first.parentType}]`,
      ...first.parentType === 'async' ? ['[async] running async data'] : [],
      // [first load] from child
      `[${first.parentType}] [${first.childType}]`,
      ...first.childType === 'async' ? [`[${first.parentType}] [${first.parentNum}] [async] [${first.childNum}] running async data`] : [],
      // [navigation] from parent
      `[${last.parentType}]`,
      ...last.parentType === 'async' ? ['[async] running async data'] : [],
    ].sort())

    await page.close()
  })

  const inwardNavigations = [
    ['/suspense/async-2/', '/suspense/async-1/async-1/'],
    ['/suspense/async-2/', '/suspense/async-1/sync-1/'],
  ]

  it.each(inwardNavigations)('should navigate from %s to a child %s with no white flash', async (start, nav) => {
    const { page, consoleLogs } = await renderPage(start)

    const slug = nav.replace(/[/-]+/g, '-')
    await page.click(`[href^="${nav}"]`)

    // wait until child selector appears and grab HTML of parent
    const text = await page.waitForFunction(slug => document.querySelector(`main:has(#child${slug})`)?.innerHTML, slug)
      .then(r => r.evaluate(r => r))

    // const text = await parent.innerText()
    expect(text).toContain('Async parent: 1')

    const first = start.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\//)!.groups!
    const last = nav.match(/\/suspense\/(?<parentType>a?sync)-(?<parentNum>\d)\/(?<childType>a?sync)-(?<childNum>\d)\//)!.groups!

    expect(consoleLogs.map(l => l.text).filter(i => !i.includes('[vite]') && !i.includes('<Suspense> is an experimental feature')).sort()).toEqual([
      // [first load] from parent
      `[${first.parentType}]`,
      ...first.parentType === 'async' ? ['[async] running async data'] : [],
      // [navigation] from parent
      `[${last.parentType}]`,
      ...last.parentType === 'async' ? ['[async] running async data'] : [],
      // [navigation] from child
      `[${last.parentType}] [${last.childType}]`,
      ...last.childType === 'async' ? [`[${last.parentType}] [${last.parentNum}] [async] [${last.childNum}] running async data`] : [],
    ].sort())

    await page.close()
  })
})

// Bug #6592
describe('page key', () => {
  it.each(['/fixed-keyed-child-parent', '/internal-layout/fixed-keyed-child-parent'])('should not cause run of setup if navigation not change page key and layout', async (path) => {
    const { page, consoleLogs } = await renderPage(`${path}/0`)

    await page.click(`[href="${path}/1"]`)
    await page.waitForSelector('#page-1')

    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, `${path}/1`)
    // Wait for all pending micro ticks to be cleared,
    // so we are not resolved too early when there are repeated page loading
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

    expect(consoleLogs.filter(l => l.text.includes('Child Setup')).length).toBe(1)
    await page.close()
  })

  it.each(['/keyed-child-parent', '/internal-layout/keyed-child-parent'])('will cause run of setup if navigation changed page key', async (path) => {
    const { page, consoleLogs } = await renderPage(`${path}/0`)

    await page.click(`[href="${path}/1"]`)
    await page.waitForSelector('#page-1')

    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, `${path}/1`)
    // Wait for all pending micro ticks to be cleared,
    // so we are not resolved too early when there are repeated page loading
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

    expect(consoleLogs.filter(l => l.text.includes('Child Setup')).length).toBe(2)
    await page.close()
  })
})

describe('route provider', () => {
  it('should preserve current route when navigation is suspended', async () => {
    const { page } = await renderPage('/route-provider/foo')
    await page.click('[href="/route-provider/bar"]')
    expect(await page.getByTestId('foo').innerText()).toMatchInlineSnapshot('"foo: /route-provider/foo - /route-provider/foo"')
    expect(await page.getByTestId('bar').innerText()).toMatchInlineSnapshot('"bar: /route-provider/bar - /route-provider/bar"')

    await page.close()
  })
})

// Bug #6592
describe('layout change not load page twice', () => {
  const cases = {
    '/with-layout': '/with-layout2',
    '/internal-layout/with-layout': '/internal-layout/with-layout2',
  }

  it.each(Object.entries(cases))('should not cause run of page setup to repeat if layout changed', async (path1, path2) => {
    const { page, consoleLogs } = await renderPage(path1)
    await page.click(`[href="${path2}"]`)
    await page.waitForSelector('#with-layout2')

    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, path2)
    // Wait for all pending micro ticks to be cleared,
    // so we are not resolved too early when there are repeated page loading
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

    expect(consoleLogs.filter(l => l.text.includes('Layout2 Page Setup')).length).toBe(1)
  })
})

describe('layout switching', () => {
  // #13309
  it('does not cause TypeError: Cannot read properties of null', async () => {
    const { page, consoleLogs, pageErrors } = await renderPage('/layout-switch/start')
    await page.click('[href="/layout-switch/end"]')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/layout-switch/end')
    expect(consoleLogs.map(i => i.text).filter(l => l.match(/error/i))).toMatchInlineSnapshot('[]')
    expect(pageErrors).toMatchInlineSnapshot('[]')
    await page.close()
  })
})

describe('automatically keyed composables', () => {
  it('should automatically generate keys', async () => {
    const html = await $fetch<string>('/keyed-composables')
    expect(html).toContain('true')
    expect(html).not.toContain('false')
  })
  it('should match server-generated keys', async () => {
    await expectNoClientErrors('/keyed-composables')
  })
  it('should not automatically generate keys', async () => {
    await expectNoClientErrors('/keyed-composables/local')
    const html = await $fetch<string>('/keyed-composables/local')
    expect(html).toContain('true')
    expect(html).not.toContain('false')
  })
})

describe.runIf(isDev() && !isWebpack)('css links', () => {
  it('should not inject links to CSS files that are inlined', async () => {
    const html = await $fetch<string>('/inline-only-css')
    expect(html).toContain('--inline-only')
    expect(html).not.toContain('inline-only.css')
    expect(html).toContain('assets/plugin.css')
  })
})

describe.skipIf(isDev() || isWebpack)('inlining component styles', () => {
  const inlinedCSS = [
    '{--plugin:"plugin"}', // CSS imported ambiently in JS/TS
    '{--global:"global";', // global css from nuxt.config
    '{--assets:"assets"}', // <script>
    '{--postcss:"postcss"}', // <style lang=postcss>
    '{--scoped:"scoped"}', // <style lang=css>
    '{--shared-component:"shared-component"}', // styles in a chunk shared between pages
    '{--server-only-child:"server-only-child"}', // child of a server-only component
    '{--server-only:"server-only"}', // server-only component not in client build
    // TODO: ideally both client/server components would have inlined css when used
    // '{--client-only:"client-only"}', // client-only component not in server build
    // TODO: currently functional component not associated with ssrContext (upstream bug or perf optimization?)
    // '{--functional:"functional"}', // CSS imported ambiently in a functional component
  ]

  it('should inline styles', async () => {
    const html = await $fetch<string>('/styles')
    for (const style of inlinedCSS) {
      expect.soft(html).toContain(style)
    }
  })

  it('should inline global css when accessing a page with `ssr: false` override via route rules', async () => {
    const globalCSS = [
      '{--plugin:"plugin"}', // CSS imported ambiently in JS/TS
      '{--global:"global";', // global css from nuxt.config
    ]
    const html = await $fetch<string>('/route-rules/spa')
    for (const style of globalCSS) {
      expect.soft(html).toContain(style)
    }
  })

  it('should emit assets referenced in inlined CSS', async () => {
    // @ts-expect-error ssssh! untyped secret property
    const publicDir = useTestContext().nuxt._nitro.options.output.publicDir
    const files = await readdir(join(publicDir, '_nuxt')).catch(() => [])
    expect(files.map(m => m.replace(/\.[\w-]+(\.\w+)$/, '$1'))).toContain('css-only-asset.svg')
  })

  it('should not include inlined CSS in generated CSS file', async () => {
    const html: string = await $fetch<string>('/styles')
    const cssFiles = new Set([...html.matchAll(/<link [^>]*href="([^"]*\.css)"(?: crossorigin)?>/g)].map(m => m[1]!))
    let css = ''
    for (const file of cssFiles || []) {
      css += await $fetch<string>(file)
    }

    // should not include inlined CSS in generated CSS files
    for (const style of inlinedCSS) {
      // TODO: remove 'ambient global' CSS from generated CSS file
      if (style === '{--plugin:"plugin"}') { continue }
      expect.soft(css).not.toContain(style)
    }

    // should include unloadable CSS in generated CSS file
    expect.soft(css).toContain('--virtual:red')
    expect.soft(css).toContain('--functional:"functional"')
    expect.soft(css).toContain('--client-only:"client-only"')
  })

  it('does not load stylesheet for page styles', async () => {
    const html: string = await $fetch<string>('/styles')
    const cssFiles = html.match(/<link [^>]*href="[^"]*\.css"/g)
    expect(cssFiles?.length).toBeGreaterThan(0)
    expect(cssFiles?.filter(m => m.includes('entry'))?.map(m => m.replace(/\.[^.]*\.css/, '.css'))).toMatchInlineSnapshot(`
      [
        "<link rel="stylesheet" href="/_nuxt/entry.css"",
      ]
    `)
  })

  it('still downloads client-only styles', async () => {
    const { page } = await renderPage('/styles')
    expect(await page.$eval('.client-only-css', e => getComputedStyle(e).color)).toBe('rgb(50, 50, 50)')

    await page.close()
  })

  it.todo('renders client-only styles only', async () => {
    const html = await $fetch<string>('/styles')
    expect(html).toContain('{--client-only:"client-only"}')
  })
})

describe('server components/islands', () => {
  it('/islands', async () => {
    const { page } = await renderPage('/islands')
    const islandRequest = page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)
    await page.locator('#increase-pure-component').click()
    await islandRequest

    await page.locator('#slot-in-server').getByText('Slot with in .server component').waitFor()
    await page.locator('#test-slot').getByText('Slot with name test').waitFor()

    // test fallback slot with v-for
    expect(await page.locator('.fallback-slot-content').all()).toHaveLength(2)
    // test islands update
    await page.locator('.box').getByText('"number": 101,').waitFor()
    const requests = [
      page.waitForResponse(response => response.url().includes('/__nuxt_island/LongAsyncComponent') && response.status() === 200),
      page.waitForResponse(response => response.url().includes('/__nuxt_island/AsyncServerComponent') && response.status() === 200),
    ]
    await page.locator('#update-server-components').click()
    await Promise.all(requests)

    await page.locator('#async-server-component-count').getByText('1').waitFor()
    await page.locator('#long-async-component-count').getByText('1').waitFor()

    // test islands slots interactivity
    await page.locator('#first-sugar-counter button').click()
    expect(await page.locator('#first-sugar-counter').innerHTML()).toContain('Sugar Counter 13')

    // test islands mounted client side with slot
    await page.locator('#show-island').click()
    expect(await page.locator('#island-mounted-client-side').innerHTML()).toContain('Interactive testing slot post SSR')
    expect(await page.locator('#island-mounted-client-side').innerHTML()).toContain('Sugar Counter')

    // test islands wrapped with client-only
    expect(await page.locator('#wrapped-client-only').innerHTML()).toContain('Was router enabled')

    if (!isWebpack) {
      // test nested client components
      await page.locator('.server-with-nested-client button').click()
      expect(await page.locator('.server-with-nested-client .sugar-counter').innerHTML()).toContain('Sugar Counter 13 x 1 = 13')
    }

    if (!isWebpack) {
      // test client component interactivity
      expect(await page.locator('.interactive-component-wrapper').innerHTML()).toContain('Sugar Counter 12')
      await page.locator('.interactive-component-wrapper button').click()
      expect(await page.locator('.interactive-component-wrapper').innerHTML()).toContain('Sugar Counter 13')
    }

    await page.close()
  })

  it('lazy server components', async () => {
    const { page, consoleLogs } = await renderPage('/server-components/lazy/start')

    await page.getByText('Go to page with lazy server component').click()

    const text = await page.innerText('pre')
    expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"> Loading server component </section><section id="no-fallback"><div></div></section><div></div>"')
    expect(text).not.toContain('async component that was very long')
    expect(text).toContain('Loading server component')

    // Wait for all pending micro ticks to be cleared
    // await page.waitForLoadState('networkidle')
    // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))
    await page.waitForFunction(() => (document.querySelector('#no-fallback') as HTMLElement)?.innerText?.includes('async component'))
    await page.waitForFunction(() => (document.querySelector('#fallback') as HTMLElement)?.innerText?.includes('async component'))

    // test navigating back and forth for lazy <ServerWithClient> component (should not trigger any issue)
    await page.goBack({ waitUntil: 'networkidle' })
    await page.getByText('Go to page with lazy server component').click()
    await page.waitForLoadState('networkidle')

    expect(consoleLogs.filter(l => l.type === 'error')).toHaveLength(0)

    await page.close()
  })

  it('should not preload ComponentWithRef', async () => {
    // should not add <ComponentWithRef> to the modulepreload list since it is used only server side
    const { page } = await renderPage('/islands')
    const links = await page.locator('link').all()
    for (const link of links) {
      if (await link.getAttribute('rel') === 'modulepreload') {
        expect(await link.getAttribute('href')).not.toContain('ComponentWithRef')
      }
    }

    await page.close()
  })

  it('non-lazy server components', async () => {
    const { page } = await renderPage('/server-components/lazy/start')
    await page.waitForLoadState('networkidle')
    await page.getByText('Go to page without lazy server component').click()

    const text = (await page.innerText('pre')).replaceAll(/ data-island-uid="([^"]*)"/g, '').replace(/data-island-component="([^"]*)"/g, 'data-island-component')

    if (isWebpack) {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <div class="sugar-counter" nuxt-client=""> Sugar Counter 12 x 1 = 12 <button> Inc </button></div></div></div>"')
    } else {
      expect(text).toMatchInlineSnapshot('" End page <pre></pre><section id="fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><section id="no-fallback"><div> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">42</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div></section><div> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <!--[--><div style="display: contents;" data-island-component></div><!--teleport start--><!--teleport end--><!--]--></div></div>"')
    }
    expect(text).toContain('async component that was very long')

    // Wait for all pending micro ticks to be cleared
    // await page.waitForLoadState('networkidle')
    // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))
    await page.waitForFunction(() => (document.querySelector('#no-fallback') as HTMLElement)?.innerText?.includes('async component'))
    await page.waitForFunction(() => (document.querySelector('#fallback') as HTMLElement)?.innerText?.includes('async component'))

    await page.close()
  })

  it('/server-page', async () => {
    const html = await $fetch<string>('/server-page')
    // test island head
    expect(html).toContain('<meta name="author" content="Nuxt">')
  })

  it('/server-page - client side navigation', async () => {
    const { page } = await renderPage('/')
    await page.getByText('to server page').click()
    await page.waitForLoadState('networkidle')

    expect(await page.innerHTML('head')).toContain('<meta name="author" content="Nuxt">')
    await page.close()
  })

  it.skipIf(isDev)('should allow server-only components to set prerender hints', async () => {
    // @ts-expect-error ssssh! untyped secret property
    const publicDir = useTestContext().nuxt._nitro.options.output.publicDir
    expect(await readdir(join(publicDir, 'some', 'url', 'from', 'server-only', 'component')).catch(() => [])).toContain(
      isRenderingJson
        ? '_payload.json'
        : '_payload.js',
    )
  })
})

describe.skipIf(isDev() || isWindows || !isRenderingJson)('prefetching', () => {
  it('should prefetch components', async () => {
    await expectNoClientErrors('/prefetch/components')
  })

  it('should prefetch server components', async () => {
    await expectNoClientErrors('/prefetch/server-components')
  })

  it('should prefetch everything needed when NuxtLink is used', async () => {
    const { page, requests } = await renderPage()

    await gotoPath(page, '/prefetch')
    await page.waitForLoadState('networkidle')

    expect(requests.some(req => req.startsWith('/__nuxt_island/AsyncServerComponent'))).toBe(true)
    requests.length = 0
    await page.click('[href="/prefetch/server-components"]')
    await page.waitForLoadState('networkidle')

    expect(await page.innerHTML('#async-server-component-count')).toBe('34')

    expect(requests.some(req => req.startsWith('/__nuxt_island/AsyncServerComponent'))).toBe(false)
    await page.close()
  })

  it('should not prefetch certain dynamic imports by default', async () => {
    const html = await $fetch<string>('/auth')
    // should not prefetch global components
    expect(html).not.toMatch(/<link [^>]*\/_nuxt\/TestGlobal[^>]*\.js"/)
    // should not prefetch all other pages
    expect(html).not.toMatch(/<link [^>]*\/_nuxt\/navigate-to[^>]*\.js"/)
  })
})

// TODO: make test less flakey on Windows
describe.runIf(isDev() && (!isWindows || !isCI))('detecting invalid root nodes', () => {
  it.each(['1', '2', '3', '4'])('should detect invalid root nodes in pages (\'/invalid-root/%s\')', async (path) => {
    const { consoleLogs, page } = await renderPage(joinURL('/invalid-root', path))
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, joinURL('/invalid-root', path))
    await expectWithPolling(
      () => consoleLogs
        .map(w => w.text).join('\n')
        .includes('does not have a single root node and will cause errors when navigating between routes'),
      true,
    )

    await page.close()
  })

  it.each(['fine'])('should not complain if there is no transition (%s)', async (path) => {
    const { consoleLogs, page } = await renderPage(joinURL('/invalid-root', path))
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, joinURL('/invalid-root', path))

    const consoleLogsWarns = consoleLogs.filter(i => i.type === 'warning')
    expect(consoleLogsWarns.length).toEqual(0)

    await page.close()
  })
})

describe('public directories', () => {
  it('should directly return public directory paths', async () => {
    const html = await $fetch<string>('/assets-custom')
    expect(html).toContain('"/public.svg"')
    expect(html).toContain('"/custom/file.svg"')
  })
})

// TODO: dynamic paths in dev
describe.skipIf(isDev())('dynamic paths', () => {
  const publicFiles = ['/public.svg', '/css-only-public-asset.svg']
  const isPublicFile = (base = '/', file: string) => {
    if (isWebpack) {
      // TODO: webpack does not yet support dynamic static paths
      expect(publicFiles).toContain(file)
      return true
    }

    expect(file).toMatch(new RegExp(`^${base.replace(/\//g, '\\/')}`))
    expect(publicFiles).toContain(file.replace(base, '/'))
    return true
  }

  it('should work with no overrides', async () => {
    const html: string = await $fetch<string>('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[2] || match[3]!
      expect(url.startsWith('/_nuxt/') || isPublicFile('/', url)).toBeTruthy()
    }
  })

  // webpack injects CSS differently
  it.skipIf(isWebpack)('adds relative paths to CSS', async () => {
    const html: string = await $fetch<string>('/assets')
    const urls = Array.from(html.matchAll(/(href|src)="(.*?)"|url\(([^)]*)\)/g)).map(m => m[2] || m[3])
    const cssURL = urls.find(u => /_nuxt\/assets.*\.css$/.test(u!))
    expect(cssURL).toBeDefined()
    const css = await $fetch<string>(cssURL!)
    const imageUrls = new Set(Array.from(css.matchAll(/url\(([^)]*)\)/g)).map(m => m[1]!.replace(/[-.]\w{8}\./g, '.')))
    expect([...imageUrls]).toMatchInlineSnapshot(`
      [
        "./logo.svg",
        "../public.svg",
      ]
    `)
  })

  it('should allow setting base URL and build assets directory', async () => {
    await startServer({
      env: {
        NUXT_APP_BUILD_ASSETS_DIR: '/_other/',
        NUXT_APP_BASE_URL: '/foo/',
      },
    })

    const html = await $fetch<string>('/foo/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[2] || match[3]!
      expect(url.startsWith('/foo/_other/') || isPublicFile('/foo/', url)).toBeTruthy()
    }

    expect(await $fetch<string>('/foo/url')).toContain('path: /foo/url')
  })

  it('should allow setting relative baseURL', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: './',
      },
    })

    const html = await $fetch<string>('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[2] || match[3]!
      expect(url.startsWith('./_nuxt/') || isPublicFile('./', url)).toBeTruthy()
      expect(url.startsWith('./_nuxt/_nuxt')).toBeFalsy()
    }
  })

  it('should use baseURL when redirecting', async () => {
    await startServer({
      env: {
        NUXT_APP_BUILD_ASSETS_DIR: '/_other/',
        NUXT_APP_BASE_URL: '/foo/',
      },
    })
    const { headers } = await fetch('/foo/navigate-to/', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/foo/')
  })

  it('should allow setting CDN URL', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: '/foo/',
        NUXT_APP_CDN_URL: 'https://example.com/',
        NUXT_APP_BUILD_ASSETS_DIR: '/_cdn/',
      },
    })

    const html = await $fetch<string>('/foo/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[2] || match[3]!
      expect(url.startsWith('https://example.com/_cdn/') || isPublicFile('https://example.com/', url)).toBeTruthy()
    }
  })

  it('restore server', async () => {
    await startServer()
  })
})

describe('app config', () => {
  it('should work', async () => {
    const html = await $fetch<string>('/app-config')

    const expectedAppConfig: Record<string, any> = {
      fromNuxtConfig: true,
      nested: {
        val: 2,
      },
      nuxt: {},
      fromLayer: true,
      userConfig: 123,
    }
    expect.soft(html).toContain(JSON.stringify(expectedAppConfig))

    const serverAppConfig = await $fetch<Record<string, any>>('/api/app-config')
    expect(serverAppConfig).toMatchObject({ appConfig: expectedAppConfig })
  })
})

describe('component islands', () => {
  it('renders components with route', async () => {
    const result = await $fetch<NuxtIslandResponse>('/__nuxt_island/RouteComponent.json?url=/foo')

    result.html = result.html.replace(/ data-island-uid="[^"]*"/g, '')
    if (isDev()) {
      result.head.link = result.head.link?.filter(l => typeof l.href !== 'string' || (!l.href.includes('_nuxt/components/islands/RouteComponent') && !l.href.includes('PureComponent') /* TODO: fix dev bug triggered by previous fetch of /islands */))
    }

    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
          "titleTemplate": "%s - Fixture",
        },
        "html": "<pre data-island-uid>    Route: /foo
        </pre>",
      }
    `)
  })

  it('render async component', async () => {
    const result = await $fetch<NuxtIslandResponse>(withQuery('/__nuxt_island/LongAsyncComponent.json', {
      props: JSON.stringify({
        count: 3,
      }),
    }))
    if (isDev()) {
      result.head.link = result.head.link?.filter(l => typeof l.href !== 'string' || (!l.href.includes('_nuxt/components/islands/LongAsyncComponent') && !l.href.includes('PureComponent') /* TODO: fix dev bug triggered by previous fetch of /islands */))
    }
    result.html = result.html.replaceAll(/ (data-island-uid|data-island-component)="([^"]*)"/g, '')
    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
          "titleTemplate": "%s - Fixture",
        },
        "html": "<div data-island-uid><div> count is above 2 </div><!--[--><div style="display: contents;" data-island-uid data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--> that was very long ... <div id="long-async-component-count">3</div>  <!--[--><div style="display: contents;" data-island-uid data-island-slot="test"><!--teleport start--><!--teleport end--></div><!--]--><p>hello world !!!</p><!--[--><div style="display: contents;" data-island-uid data-island-slot="hello"><!--teleport start--><!--teleport end--></div><!--teleport start--><!--teleport end--><!--]--><!--[--><div style="display: contents;" data-island-uid data-island-slot="fallback"><!--teleport start--><!--teleport end--></div><!--teleport start--><!--teleport end--><!--]--></div>",
        "slots": {
          "default": {
            "props": [],
          },
          "fallback": {
            "fallback": "<!--teleport start anchor--><!--[--><div style="display:contents;"><div>fall slot -- index: 0</div><div class="fallback-slot-content"> wonderful fallback </div></div><div style="display:contents;"><div>back slot -- index: 1</div><div class="fallback-slot-content"> wonderful fallback </div></div><!--]--><!--teleport anchor-->",
            "props": [
              {
                "t": "fall",
              },
              {
                "t": "back",
              },
            ],
          },
          "hello": {
            "fallback": "<!--teleport start anchor--><!--[--><div style="display:contents;"><div> fallback slot -- index: 0</div></div><div style="display:contents;"><div> fallback slot -- index: 1</div></div><div style="display:contents;"><div> fallback slot -- index: 2</div></div><!--]--><!--teleport anchor-->",
            "props": [
              {
                "t": 0,
              },
              {
                "t": 1,
              },
              {
                "t": 2,
              },
            ],
          },
          "test": {
            "props": [
              {
                "count": 3,
              },
            ],
          },
        },
      }
    `)
  })

  it('render .server async component', async () => {
    const result = await $fetch<NuxtIslandResponse>(withQuery('/__nuxt_island/AsyncServerComponent.json', {
      props: JSON.stringify({
        count: 2,
      }),
    }))
    if (isDev()) {
      result.head.link = result.head.link?.filter(l => typeof l.href === 'string' && !l.href.includes('PureComponent') /* TODO: fix dev bug triggered by previous fetch of /islands */ && (!l.href.startsWith('_nuxt/components/islands/') || l.href.includes('AsyncServerComponent')))
    }
    result.props = {}
    result.components = {}
    result.slots = {}
    result.html = result.html.replaceAll(/ (data-island-uid|data-island-component)="([^"]*)"/g, '')

    expect(result).toMatchInlineSnapshot(`
      {
        "components": {},
        "head": {
          "link": [],
          "style": [],
          "titleTemplate": "%s - Fixture",
        },
        "html": "<div data-island-uid> This is a .server (20ms) async component that was very long ... <div id="async-server-component-count">2</div><div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--[--><div style="display: contents;" data-island-uid data-island-slot="default"><!--teleport start--><!--teleport end--></div><!--]--></div>",
        "props": {},
        "slots": {},
      }
    `)
  })

  if (!isWebpack) {
    it('render server component with selective client hydration', async () => {
      const result = await $fetch<NuxtIslandResponse>('/__nuxt_island/ServerWithClient')
      if (isDev()) {
        result.head.link = result.head.link?.filter(l => typeof l.href !== 'string' || (!l.href.includes('_nuxt/components/islands/LongAsyncComponent') && !l.href.includes('PureComponent') /* TODO: fix dev bug triggered by previous fetch of /islands */))

        if (!result.head.link) {
          delete result.head.link
        }
      }
      const { components } = result
      result.components = {}
      result.slots = {}
      result.html = result.html.replace(/data-island-component="([^"]*)"/g, 'data-island-component')

      const teleportsEntries = Object.entries(components || {})

      expect(result).toMatchInlineSnapshot(`
        {
          "components": {},
          "head": {
            "link": [],
            "style": [],
            "titleTemplate": "%s - Fixture",
          },
          "html": "<div data-island-uid> ServerWithClient.server.vue : <p>count: 0</p> This component should not be preloaded <div><!--[--><div>a</div><div>b</div><div>c</div><!--]--></div> This is not interactive <div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><div class="interactive-component-wrapper" style="border:solid 1px red;"> The component below is not a slot but declared as interactive <!--[--><div style="display: contents;" data-island-uid data-island-component></div><!--teleport start--><!--teleport end--><!--]--></div></div>",
          "slots": {},
        }
      `)
      expect(teleportsEntries).toHaveLength(1)
      expect(teleportsEntries[0]![1].props).toMatchInlineSnapshot(`
        {
          "multiplier": 1,
        }
      `)
      expect(teleportsEntries[0]![1].html).toMatchInlineSnapshot(`"<div class="sugar-counter"> Sugar Counter 12 x 1 = 12 <button> Inc </button></div><!--teleport anchor-->"`)
    })
  }

  it('renders pure components', async () => {
    const result = await $fetch<NuxtIslandResponse>(withQuery('/__nuxt_island/PureComponent.json', {
      props: JSON.stringify({
        bool: false,
        number: 3487,
        str: 'something',
        obj: { foo: 42, bar: false, me: 'hi' },
      }),
    }))
    result.html = result.html.replace(/ data-island-uid="([^"]*)"/g, '')

    if (isDev()) {
      const fixtureDir = normalize(fileURLToPath(new URL('./fixtures/basic', import.meta.url)))
      for (const key in result.head) {
        if (key === 'link') {
          result.head[key] = result.head[key]?.map((h) => {
            h.href &&= (h.href).replace(fixtureDir, '/<rootDir>').replaceAll('//', '/')
            return h
          })
        }
      }
    }

    // TODO: fix rendering of styles in webpack
    if (!isDev() && !isWebpack) {
      expect(normaliseIslandResult(result).head).toMatchInlineSnapshot(`
        {
          "link": [],
          "style": [
            {
              "innerHTML": "pre[data-v-xxxxx]{color:#00f}",
            },
          ],
          "titleTemplate": "%s - Fixture",
        }
      `)
    } else if (isDev() && !isWebpack) {
      // TODO: resolve dev bug triggered by earlier fetch of /vueuse-head page
      // https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/runtime/nitro/handlers/renderer.ts#L139
      result.head.link = result.head.link?.filter(l => typeof l.href !== 'string' || !l.href.includes('SharedComponent'))
      if (result.head.link?.[0]?.href) {
        result.head.link[0].href = result.head.link[0].href.replace(/scoped=[^?&]+/, 'scoped=xxxxx')
      }

      expect(result.head).toMatchInlineSnapshot(`
        {
          "link": [
            {
              "crossorigin": "",
              "href": "/_nuxt/components/islands/PureComponent.vue?vue&type=style&index=0&scoped=xxxxx&lang.css",
              "rel": "stylesheet",
            },
          ],
          "style": [],
          "titleTemplate": "%s - Fixture",
        }
      `)
    }

    expect(result.html.replace(/data-v-\w+|"|<!--.*-->/g, '').replace(/data-island-uid="[^"]"/g, '')).toMatchInlineSnapshot(`
      "<div data-island-uid > Was router enabled: true <br > Props: <pre >{
        number: 3487,
        str: something,
        obj: {
          foo: 42,
          bar: false,
          me: hi
        },
        bool: false
      }</pre></div>"
    `)
  })

  it('test client-side navigation', async () => {
    const { page } = await renderPage('/')
    await page.click('#islands')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/islands')

    await page.locator('#increase-pure-component').click()
    await page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)

    await page.locator('#slot-in-server').getByText('Slot with in .server component').waitFor()
    await page.locator('#test-slot').getByText('Slot with name test').waitFor()

    // test islands update
    expect(await page.locator('.box').innerHTML()).toContain('"number": 101,')
    const islandRequests = [
      page.waitForResponse(response => response.url().includes('/__nuxt_island/LongAsyncComponent') && response.status() === 200),
      page.waitForResponse(response => response.url().includes('/__nuxt_island/AsyncServerComponent') && response.status() === 200),
    ]
    await page.locator('#update-server-components').click()
    await Promise.all(islandRequests)

    await page.locator('#long-async-component-count').getByText('1').waitFor()

    // test islands slots interactivity
    await page.locator('#first-sugar-counter button').click()
    expect(await page.locator('#first-sugar-counter').innerHTML()).toContain('Sugar Counter 13')

    if (!isWebpack) {
      // test client component interactivity
      expect(await page.locator('.interactive-component-wrapper').innerHTML()).toContain('Sugar Counter 12')
      await page.locator('.interactive-component-wrapper button').click()
      expect(await page.locator('.interactive-component-wrapper').innerHTML()).toContain('Sugar Counter 13')
    }

    await page.close()
  })

  it.skipIf(isDev())('should not render an error when having a baseURL', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: '/foo/',
      },
    })

    const result = await fetch('/foo/islands')
    expect(result.status).toBe(200)

    await startServer()
  })

  it('render island page', async () => {
    const { page } = await renderPage('/')

    const islandPageRequest = page.waitForRequest((req) => {
      return req.url().includes('/__nuxt_island/page_server-page')
    })
    await page.getByText('to server page').click()
    await islandPageRequest
    await page.locator('#server-page').waitFor()
  })
})

describe.runIf(isDev() && !isWebpack)('vite plugins', () => {
  it('does not override vite plugins', async () => {
    expect(await $fetch<string>('/vite-plugin-without-path')).toBe('vite-plugin without path')
    expect(await $fetch<string>('/__nuxt-test')).toBe('vite-plugin with __nuxt prefix')
  })
  it('does not allow direct access to nuxt source folder', async () => {
    expect(await fetch('/app.config').then(r => r.status)).toBe(404)
  })
})

describe.skipIf(isDev() || isWindows || !isRenderingJson)('payload rendering', () => {
  it('renders a payload', async () => {
    const payload = await $fetch<string>('/random/a/_payload.json', { responseType: 'text' })
    const data = parsePayload(payload)
    expect(typeof data.prerenderedAt).toEqual('number')

    expect(data.data).toMatchObject({
      hey: {
        baz: 'qux',
        foo: 'bar',
      },
      rand_a: expect.arrayContaining([expect.anything()]),
    })
  })

  it('does not fetch a prefetched payload', async () => {
    const { page, requests } = await renderPage()

    await gotoPath(page, '/random/a')

    // We are manually prefetching other payloads
    await page.waitForRequest(request => request.url().includes('/random/c/_payload.json'))

    // We are not triggering API requests in the payload
    expect(requests).not.toContainEqual(expect.stringContaining('/api/random'))
    expect(requests).not.toContainEqual(expect.stringContaining('/__nuxt_island'))
    // requests.length = 0

    await page.click('[href="/random/b"]')
    await page.waitForLoadState('networkidle')

    // We are not triggering API requests in the payload in client-side nav
    expect(requests).not.toContain('/api/random')
    expect(requests).not.toContainEqual(expect.stringContaining('/__nuxt_island'))

    // We are fetching a payload we did not prefetch
    expect(requests).toContainEqual(expect.stringContaining('/random/b/_payload.json'))

    // We are not refetching payloads we've already prefetched
    // expect(requests.filter(p => p.includes('_payload')).length).toBe(1)
    // requests.length = 0

    await page.click('[href="/random/c"]')
    await page.waitForLoadState('networkidle')

    // We are not triggering API requests in the payload in client-side nav
    expect(requests).not.toContain('/api/random')
    expect(requests).not.toContainEqual(expect.stringContaining('/__nuxt_island'))

    // We are not refetching payloads we've already prefetched
    // Note: we refetch on dev as urls differ between '' and '?import'
    // expect(requests.filter(p => p.includes('_payload')).length).toBe(isDev() ? 1 : 0)

    await page.close()
  })

  it.skipIf(!isRenderingJson)('should not include server-component HTML in payload', async () => {
    const payload = await $fetch<string>('/prefetch/server-components/_payload.json', { responseType: 'text' })
    const entries = Object.entries(parsePayload(payload))
    const [key, serializedComponent] = entries.find(([key]) => key.startsWith('AsyncServerComponent')) || []
    expect(serializedComponent).toEqual(key)
  })
})

describe.skipIf(process.env.TEST_CONTEXT !== 'async')('Async context', () => {
  it('should be available', async () => {
    expect(await $fetch<string>('/async-context')).toContain('&quot;hasApp&quot;: true')
  })
})

describe.skipIf(process.env.TEST_CONTEXT === 'async')('Async context', () => {
  it('should be unavailable', async () => {
    expect(await $fetch<string>('/async-context')).toContain('&quot;hasApp&quot;: false')
  })
})

describe.skipIf(isWindows)('useAsyncData', () => {
  it('works after useNuxtData call', async () => {
    const page = await createPage('/useAsyncData/nuxt-data')
    expect(await page.locator('body').getByText('resolved:true').textContent()).toContain('resolved:true')
    await page.close()
  })

  it('single request resolves', async () => {
    await expectNoClientErrors('/useAsyncData/single')
  })

  it('two requests resolve', async () => {
    await expectNoClientErrors('/useAsyncData/double')
  })

  it('two requests resolve and sync', async () => {
    await $fetch<string>('/useAsyncData/refresh')
  })

  it('two requests made at once resolve and sync', async () => {
    await expectNoClientErrors('/useAsyncData/promise-all')
  })

  it('requests status can be used', async () => {
    const html = await $fetch<string>('/useAsyncData/status')
    expect(html).toContain('true')
    expect(html).not.toContain('false')

    const page = await createPage('/useAsyncData/status')
    await page.locator('#status5-values').getByText('idle,pending,success').waitFor()
    await page.close()
  })

  it('data is null after navigation when immediate false', async () => {
    const defaultValue = 'undefined'

    const { page } = await renderPage('/useAsyncData/immediate-remove-unmounted')
    expect(await page.locator('#immediate-data').getByText(defaultValue).textContent()).toBe(defaultValue)

    await page.click('#execute-btn')
    expect(await page.locator('#immediate-data').getByText(',').textContent()).not.toContain(defaultValue)

    await page.click('#to-index')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/')

    await page.click('#to-immediate-remove-unmounted')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/useAsyncData/immediate-remove-unmounted')
    expect(await page.locator('#immediate-data').getByText(defaultValue).textContent()).toBe(defaultValue)

    await page.click('#execute-btn')
    expect(await page.locator('#immediate-data').getByText(',').textContent()).not.toContain(defaultValue)

    await page.close()
  })
  it('works with useId', async () => {
    const html = await $fetch<string>('/useAsyncData/use-id')
    expect(html).toContain('<div>v-0-0-0</div> v-0-0</div>')
    await expectNoClientErrors('/useAsyncData/use-id')
  })
})

describe.runIf(isDev())('component testing', () => {
  it('should work', async () => {
    const comp1 = await $fetchComponent('components/Counter.vue', { multiplier: 2 })
    expect(comp1).toContain('12 x 2 = 24')

    const comp2 = await $fetchComponent('components/Counter.vue', { multiplier: 4 })
    expect(comp2).toContain('12 x 4 = 48')
  })
})

describe('keepalive', () => {
  it('should not keepalive by default', async () => {
    const { page, consoleLogs } = await renderPage('/keepalive')

    const pageName = 'not-keepalive'
    await page.click(`#${pageName}`)
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, `/keepalive/${pageName}`)

    expect(consoleLogs.map(l => l.text).filter(t => t.includes('keepalive'))).toEqual([`${pageName}: onMounted`])

    await page.close()
  })

  it('should not keepalive when included in app config but config in nuxt-page is not undefined', async () => {
    const { page, consoleLogs } = await renderPage('/keepalive')

    const pageName = 'keepalive-in-config'
    await page.click(`#${pageName}`)
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, `/keepalive/${pageName}`)

    expect(consoleLogs.map(l => l.text).filter(t => t.includes('keepalive'))).toEqual([`${pageName}: onMounted`])

    await page.close()
  })

  it('should not keepalive when included in app config but exclueded in nuxt-page', async () => {
    const { page, consoleLogs } = await renderPage('/keepalive')

    const pageName = 'not-keepalive-in-nuxtpage'
    await page.click(`#${pageName}`)
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, `/keepalive/${pageName}`)

    expect(consoleLogs.map(l => l.text).filter(t => t.includes('keepalive'))).toEqual([`${pageName}: onMounted`])

    await page.close()
  })

  it('should keepalive when included in nuxt-page', async () => {
    const { page, consoleLogs } = await renderPage('/keepalive')

    const pageName = 'keepalive-in-nuxtpage'
    await page.click(`#${pageName}`)
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, `/keepalive/${pageName}`)

    expect(consoleLogs.map(l => l.text).filter(t => t.includes('keepalive'))).toEqual([`${pageName}: onMounted`, `${pageName}: onActivated`])

    await page.close()
  })

  it('should preserve keepalive config when navigate routes in nuxt-page', async () => {
    const { page, consoleLogs } = await renderPage('/keepalive')

    const slugs = [
      'keepalive-in-nuxtpage',
      'keepalive-in-nuxtpage-2',
      'keepalive-in-nuxtpage',
      'not-keepalive',
      'keepalive-in-nuxtpage-2',
    ]

    for (const slug of slugs) {
      await page.click(`#${slug}`)
      await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, `/keepalive/${slug}`)
    }

    expect(consoleLogs.map(l => l.text).filter(t => t.includes('keepalive'))).toEqual([
      'keepalive-in-nuxtpage: onMounted',
      'keepalive-in-nuxtpage: onActivated',
      'keepalive-in-nuxtpage: onDeactivated',
      'keepalive-in-nuxtpage-2: onMounted',
      'keepalive-in-nuxtpage-2: onActivated',
      'keepalive-in-nuxtpage: onActivated',
      'keepalive-in-nuxtpage-2: onDeactivated',
      'keepalive-in-nuxtpage: onDeactivated',
      'not-keepalive: onMounted',
      'keepalive-in-nuxtpage-2: onActivated',
      'not-keepalive: onUnmounted',
    ])

    await page.close()
  })
})

describe('teleports', () => {
  it('should append teleports to body', async () => {
    const html = await $fetch<string>('/teleport')

    // Teleport is prepended to body, before the __nuxt div
    expect(html).toContain('<div>Teleport</div><!--teleport anchor--><div id="__nuxt">')
    // Teleport start and end tag are rendered as expected
    expect(html).toContain('<div><!--teleport start--><!--teleport end--><h1>Normal content</h1></div>')
  })
  it('should render teleports to app teleports element', async () => {
    const html = await $fetch<string>('/nuxt-teleport')

    // Teleport is appended to body, after the __nuxt div
    expect(html).toContain('<div><!--teleport start--><!--teleport end--><h1>Normal content</h1></div></div><!--]--></div><span id="nuxt-teleport"><!--teleport start anchor--><div>Nuxt Teleport</div><!--teleport anchor--></span><script')
  })
})

describe('experimental', () => {
  it('decorators support works', async () => {
    const html = await $fetch('/experimental/decorators')
    expect(html).toContain('decorated-decorated')
    expectNoClientErrors('/experimental/decorators')
  })

  it('Node.js compatibility for client-side', async () => {
    const { page } = await renderPage('/experimental/node-compat')
    await page.locator('body').getByText('Nuxt is Awesome!').waitFor()
    expect(await page.innerHTML('body')).toContain('CWD: [available]')
    await page.close()
  }, 40_000)
})

function normaliseIslandResult (result: NuxtIslandResponse) {
  if (result.head.style) {
    for (const style of result.head.style) {
      if (typeof style !== 'string') {
        style.innerHTML &&=
            (style.innerHTML as string)
              .replace(/data-v-[a-z0-9]+/g, 'data-v-xxxxx')
              // Vite 6 enables CSS minify by default for SSR
              .replace(/blue/, '#00f')
        style.key &&= style.key.replace(/-[a-z0-9]+$/i, '')
      }
    }
  }
  return result
}

describe('import components', () => {
  let html = ''

  it.sequential('fetch import-components page', async () => {
    html = await $fetch<string>('/import-components')
  })

  it('load default component with mode all', () => {
    expect(html).toContain('default-comp-all')
  })

  it('load default component with mode client', () => {
    expect(html).toContain('default-comp-client')
  })

  it('load default component with mode server', () => {
    expect(html).toContain('default-comp-server')
  })

  it('load named component with mode all', () => {
    expect(html).toContain('named-comp-all')
  })

  it('load named component with mode client', () => {
    expect(html).toContain('named-comp-client')
  })

  it('load named component with mode server', () => {
    expect(html).toContain('named-comp-server')
  })
})

describe('lazy import components', () => {
  let html = ''

  it.sequential('fetch lazy-import-components page', async () => {
    html = await $fetch<string>('/lazy-import-components')
  })

  it('lazy load named component with mode all', () => {
    expect(html).toContain('lazy-named-comp-all')
  })

  it('lazy load named component with mode client', () => {
    expect(html).toContain('lazy-named-comp-client')
  })

  it('lazy load named component with mode server', () => {
    expect(html).toContain('lazy-named-comp-server')
  })

  it('lazy load delayed hydration comps at the right time', { timeout: 20_000 }, async () => {
    const { page } = await renderPage('/lazy-import-components')

    const hydratedText = 'This is mounted.'
    const unhydratedText = 'This is not mounted.'

    expect.soft(html).toContain(unhydratedText)
    expect.soft(html).not.toContain(hydratedText)

    await page.locator('data-testid=hydrate-on-visible', { hasText: hydratedText }).waitFor()
    expect.soft(await page.locator('data-testid=hydrate-on-visible-bottom').textContent().then(r => r?.trim())).toBe(unhydratedText)

    await page.locator('data-testid=hydrate-on-interaction-default', { hasText: unhydratedText }).waitFor()
    await page.locator('data-testid=hydrate-on-interaction-click', { hasText: unhydratedText }).waitFor()

    await page.locator('data-testid=hydrate-when-always', { hasText: hydratedText }).waitFor()
    await page.locator('data-testid=hydrate-when-state', { hasText: unhydratedText }).waitFor()

    const component = page.getByTestId('hydrate-on-interaction-default')
    await component.hover()
    await page.locator('data-testid=hydrate-on-interaction-default', { hasText: hydratedText }).waitFor()

    await page.getByTestId('button-increase-state').click()
    await page.locator('data-testid=hydrate-when-state', { hasText: hydratedText }).waitFor()

    await page.getByTestId('hydrate-on-visible-bottom').scrollIntoViewIfNeeded()
    await page.locator('data-testid=hydrate-on-visible-bottom', { hasText: hydratedText }).waitFor()

    await page.locator('data-testid=hydrate-never', { hasText: unhydratedText }).waitFor()

    await page.close()
  })
  it('respects custom delayed hydration triggers and overrides defaults', async () => {
    const { page } = await renderPage('/lazy-import-components')

    const unhydratedText = 'This is not mounted.'
    const hydratedText = 'This is mounted.'

    await page.locator('data-testid=hydrate-on-interaction-click', { hasText: unhydratedText }).waitFor({ state: 'visible' })

    await page.getByTestId('hydrate-on-interaction-click').hover()
    await page.locator('data-testid=hydrate-on-interaction-click', { hasText: unhydratedText }).waitFor({ state: 'visible' })

    await page.getByTestId('hydrate-on-interaction-click').click()
    await page.locator('data-testid=hydrate-on-interaction-click', { hasText: hydratedText }).waitFor({ state: 'visible' })
    await page.locator('data-testid=hydrate-on-interaction-click', { hasText: unhydratedText }).waitFor({ state: 'hidden' })

    await page.close()
  })

  it('does not delay hydration of components named after modifiers', async () => {
    const { page } = await renderPage('/lazy-import-components')

    await page.locator('data-testid=event-view-normal-component', { hasText: 'This is mounted.' }).waitFor()
    await page.locator('data-testid=event-view-normal-component', { hasText: 'This is not mounted.' }).waitFor({ state: 'hidden' })

    await page.close()
  })

  it('handles time-based hydration correctly', async () => {
    const unhydratedText = 'This is not mounted.'
    const html = await $fetch<string>('/lazy-import-components/time')
    expect(html).toContain(unhydratedText)

    const { page, consoleLogs } = await renderPage('/lazy-import-components/time')

    const hydratedText = 'This is mounted.'
    await page.locator('[data-testid=hydrate-after]', { hasText: hydratedText }).waitFor({ state: 'visible' })

    const hydrationLogs = consoleLogs.filter(log => !log.text.includes('[vite]') && !log.text.includes('<Suspense>'))
    expect(hydrationLogs.map(log => log.text)).toEqual([])

    await page.close()
  })

  it('keeps reactivity with models', async () => {
    const { page } = await renderPage('/lazy-import-components/model-event')

    const countLocator = page.getByTestId('count')
    const incrementButton = page.getByTestId('increment')

    await countLocator.waitFor()

    for (let i = 0; i < 10; i++) {
      expect(await countLocator.textContent()).toBe(`${i}`)
      await incrementButton.hover()
      await incrementButton.click()
    }

    expect(await countLocator.textContent()).toBe('10')

    await page.close()
  })

  it('emits hydration events', async () => {
    const { page, consoleLogs } = await renderPage('/lazy-import-components/model-event')

    const initialLogs = consoleLogs.filter(log => log.type === 'log' && log.text === 'Component hydrated')
    expect(initialLogs.length).toBe(0)

    await page.getByTestId('count').click()

    // Wait for all pending micro ticks to be cleared in case hydration hasn't finished yet.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))
    const hydrationLogs = consoleLogs.filter(log => log.type === 'log' && log.text === 'Component hydrated')
    expect(hydrationLogs.length).toBeGreaterThan(0)

    await page.close()
  })
})

describe('defineNuxtComponent', () => {
  it('watches duplicate updates after navigation', async () => {
    const { page } = await renderPage('/define-nuxt-component')
    await page.getByTestId('define-nuxt-component-bar').click()
    await page.getByTestId('define-nuxt-component-state').click()
    await page.getByTestId('define-nuxt-component-foo').click()
    expect(await page.getByTestId('define-nuxt-component-state').first().innerText()).toBe('2')
  })

  it('get correctly route when navigating between routes', async () => {
    const { page } = await renderPage('/define-nuxt-component/route-1')
    await page.getByText('Go to route 2').click()
    expect(await page.getByTestId('define-nuxt-component-route-2-path').innerText()).include('route-2')

    await page.getByText('Go to route 1').click()
    expect(await page.getByTestId('define-nuxt-component-route-1-path').innerText()).include('route-1')
  })

  it ('should get correctly inject value', async () => {
    const { page } = await renderPage('/define-nuxt-component/inject')
    expect(await page.getByTestId('define-nuxt-component-inject-value').innerText()).include('bar')
  })
})

describe('namespace access to useNuxtApp', () => {
  it('should return the nuxt instance when used with correct appId', async () => {
    const { page, pageErrors } = await renderPage('/namespace-nuxt-app')

    expect(pageErrors).toEqual([])

    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)

    // Defaulting to appId
    await page.evaluate(() => window.useNuxtApp?.())
    // Using correct configured appId
    // @ts-expect-error not public API yet
    await page.evaluate(() => window.useNuxtApp?.('nuxt-app-basic'))

    await page.close()
  })

  it('should throw an error when used with wrong appId', async () => {
    const { page, pageErrors } = await renderPage('/namespace-nuxt-app')

    expect(pageErrors).toEqual([])

    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)

    let error: unknown
    try {
      // Using wrong/unknown appId
      // @ts-expect-error not public API yet
      await page.evaluate(() => window.useNuxtApp?.('nuxt-app-unknown'))
    } catch (err) {
      error = err
    }

    expect(error).toBeTruthy()

    await page.close()
  })
})

describe('nuxt-time', () => {
  it('ssr', async () => {
    const html = await $fetch<string>('/components/nuxt-time')
    const snap = html.match(/<time[^>]*data-testid="fixed"[^>]*>([^<]*)<\/time>/)?.[0].replace(/ data-prehydrate-id="[^"]*"/g, '')
    expect(snap).toContain(
      '<time data-month="long" data-day="numeric" datetime="2023-02-11T08:24:08.396Z" data-testid="fixed">',
    )
  })

  it.skipIf(isDev)('injects one script', async () => {
    const html = await $fetch<string>('/components/nuxt-time')

    const string = createRegExp(exactly('document.querySelectorAll'), ['g'])
    expect(html.match(string)?.length).toEqual(1)
  })

  it('has no hydration errors on the client', async () => {
    const page = await createPage(undefined, { locale: 'en-GB' })
    const logs: string[] = []

    page.on('console', (event) => {
      if (!event.text().includes('<Suspense>') && !event.text().includes('[vite]')) {
        logs.push(event.text())
      }
    })

    await page.goto(url('/components/nuxt-time'), { waitUntil: 'networkidle' })

    expect(await page.getByTestId('switchable').textContent()).toMatchInlineSnapshot(
      '"11 February at 8"',
    )
    expect(await page.getByTestId('fixed').textContent()).toMatchInlineSnapshot('"11 February"')

    await page.getByText('Switch locale').click()
    expect(await page.getByTestId('switchable').textContent()).toMatchInlineSnapshot(
      '"11 février à 8"',
    )
    expect(await page.getByTestId('fixed').textContent()).toMatchInlineSnapshot('"11 février"')

    await page.getByText('Update time').click()
    expect(await page.getByTestId('switchable').textContent()).not.toEqual('11 février à 8')
    expect(await page.getByTestId('fixed').textContent()).toMatchInlineSnapshot('"11 février"')

    // No hydration errors
    expect(logs.join('')).toMatchInlineSnapshot('""')
  })

  it('displays relative time correctly', async () => {
    const page = await createPage(undefined, { locale: 'en-GB' })
    const logs: string[] = []

    page.on('console', (event) => {
      if (!event.text().includes('<Suspense>') && !event.text().includes('[vite]')) {
        logs.push(event.text())
      }
    })

    await page.goto(url('/components/nuxt-time'), { waitUntil: 'networkidle' })

    expect(await page.getByTestId('relative').textContent()).toMatchInlineSnapshot(
      '"30 seconds ago"',
    )

    await page.getByTestId('relative').getByText('32 seconds ago').textContent()

    // No hydration errors
    expect(logs.join('')).toMatchInlineSnapshot('""')
  })
})
