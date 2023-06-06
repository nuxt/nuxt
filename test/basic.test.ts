import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { joinURL, withQuery } from 'ufo'
import { isCI, isWindows } from 'std-env'
import { normalize } from 'pathe'
import { $fetch, createPage, fetch, isDev, setup, startServer, url } from '@nuxt/test-utils'
import { $fetchComponent } from '@nuxt/test-utils/experimental'

import type { NuxtIslandResponse } from '../packages/nuxt/src/core/runtime/nitro/renderer'
import { expectNoClientErrors, expectWithPolling, isRenderingJson, parseData, parsePayload, renderPage, withLogs } from './utils'

const isWebpack = process.env.TEST_BUILDER === 'webpack'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  dev: process.env.TEST_ENV === 'dev',
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 240 : 120) * 1000,
  nuxtConfig: {
    builder: isWebpack ? 'webpack' : 'vite',
    buildDir: process.env.NITRO_BUILD_DIR,
    nitro: { output: { dir: process.env.NITRO_OUTPUT_DIR } }
  }
})

describe('server api', () => {
  it('should serialize', async () => {
    expect(await $fetch('/api/hello')).toBe('Hello API')
    expect(await $fetch('/api/hey')).toEqual({
      foo: 'bar',
      baz: 'qux'
    })
  })

  it('should preserve states', async () => {
    expect(await $fetch('/api/counter')).toEqual({ count: 0 })
    expect(await $fetch('/api/counter')).toEqual({ count: 1 })
    expect(await $fetch('/api/counter')).toEqual({ count: 2 })
    expect(await $fetch('/api/counter')).toEqual({ count: 3 })
  })
})

describe('route rules', () => {
  it('should enable spa mode', async () => {
    const { script, attrs } = parseData(await $fetch('/route-rules/spa'))
    expect(script.serverRendered).toEqual(false)
    if (isRenderingJson) {
      expect(attrs['data-ssr']).toEqual('false')
    }
    await expectNoClientErrors('/route-rules/spa')
  })

  it('test noScript routeRules', async () => {
    const page = await createPage('/no-scripts')
    expect(await page.locator('script').all()).toHaveLength(0)
    await page.close()
  })
})

describe('modules', () => {
  it('should auto-register modules in ~/modules', async () => {
    const result = await $fetch('/auto-registered-module')
    expect(result).toEqual('handler added by auto-registered module')
  })
})

describe('pages', () => {
  it('render index', async () => {
    const html = await $fetch('/')

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
    expect(html.replace(/ nuxt-ssr-component-uid="[^"]*"/, '')).toContain('<div class="server-only" style="background-color:gray;"> server-only component </div>')
    // should register global components automatically
    expect(html).toContain('global component registered automatically')
    expect(html).toContain('global component via suffix')

    await expectNoClientErrors('/')
  })

  // TODO: support jsx with webpack
  it.runIf(!isWebpack)('supports jsx', async () => {
    const html = await $fetch('/jsx')

    // should import JSX/TSX components with custom elements
    expect(html).toContain('TSX component')
    expect(html).toContain('<custom-component>custom</custom-component>')
  })

  it('respects aliases in page metadata', async () => {
    const html = await $fetch('/some-alias')
    expect(html).toContain('Hello Nuxt 3!')
  })

  it('respects redirects in page metadata', async () => {
    const { headers } = await fetch('/redirect', { redirect: 'manual' })
    expect(headers.get('location')).toEqual('/')
  })

  it('includes page metadata from pages added in pages:extend hook', async () => {
    const res = await fetch('/page-extend')
    expect(res.headers.get('x-extend')).toEqual('added in pages:extend')
  })

  it('validates routes', async () => {
    const { status, headers } = await fetch('/forbidden')
    expect(status).toEqual(404)
    expect(headers.get('Set-Cookie')).toBe('set-in-plugin=true; Path=/')

    const page = await createPage('/navigate-to-forbidden')
    await page.waitForLoadState('networkidle')
    await page.getByText('should throw a 404 error').click()
    expect(await page.getByRole('heading').textContent()).toMatchInlineSnapshot('"Page Not Found: /forbidden"')

    await page.goto(url('/navigate-to-forbidden'))
    await page.waitForLoadState('networkidle')
    await page.getByText('should be caught by catchall').click()
    expect(await page.getByRole('heading').textContent()).toMatchInlineSnapshot('"[...slug].vue"')

    await page.close()
  })

  it('returns 500 when there is an infinite redirect', async () => {
    const { status } = await fetch('/redirect-infinite', { redirect: 'manual' })
    expect(status).toEqual(500)
  })

  it('render catchall page', async () => {
    const res = await fetch('/not-found')
    expect(res.status).toEqual(200)

    const html = await res.text()

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('[...slug].vue')
    expect(html).toContain('catchall at not-found')

    // Middleware still runs after validation: https://github.com/nuxt/nuxt/issues/15650
    expect(html).toContain('Middleware ran: true')

    await expectNoClientErrors('/not-found')
  })

  it('preserves query', async () => {
    const html = await $fetch('/?test=true')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    // should render text
    expect(html).toContain('Path: /?test=true')

    await expectNoClientErrors('/?test=true')
  })

  it('/nested/[foo]/[bar].vue', async () => {
    const html = await $fetch('/nested/one/two')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('nested/[foo]/[bar].vue')
    expect(html).toContain('foo: one')
    expect(html).toContain('bar: two')
  })

  it('/nested/[foo]/index.vue', async () => {
    const html = await $fetch('/nested/foobar')

    // TODO: should resolved to same entry
    // const html2 = await $fetch('/nested/foobar/index')
    // expect(html).toEqual(html2)

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('nested/[foo]/index.vue')
    expect(html).toContain('foo: foobar')

    await expectNoClientErrors('/nested/foobar')
  })

  it('/nested/[foo]/user-[group].vue', async () => {
    const html = await $fetch('/nested/foobar/user-admin')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('nested/[foo]/user-[group].vue')
    expect(html).toContain('foo: foobar')
    expect(html).toContain('group: admin')

    await expectNoClientErrors('/nested/foobar/user-admin')
  })

  it('/parent', async () => {
    const html = await $fetch('/parent')
    expect(html).toContain('parent/index')

    await expectNoClientErrors('/parent')
  })

  it('/another-parent', async () => {
    const html = await $fetch('/another-parent')
    expect(html).toContain('another-parent/index')

    await expectNoClientErrors('/another-parent')
  })

  it('/client-only-components', async () => {
    const html = await $fetch('/client-only-components')
    // ensure fallbacks with classes and arbitrary attributes are rendered
    expect(html).toContain('<div class="client-only-script" foo="bar">')
    expect(html).toContain('<div class="client-only-script-setup" foo="hello">')
    expect(html).toContain('<div>Fallback</div>')
    // ensure components are not rendered server-side
    expect(html).not.toContain('Should not be server rendered')

    await expectNoClientErrors('/client-only-components')

    const page = await createPage('/client-only-components')

    await page.waitForLoadState('networkidle')

    const hiddenSelectors = [
      '.string-stateful-should-be-hidden',
      '.client-script-should-be-hidden',
      '.string-stateful-script-should-be-hidden',
      '.no-state-hidden'
    ]
    const visibleSelectors = [
      '.string-stateful',
      '.string-stateful-script',
      '.client-only-script',
      '.client-only-script-setup',
      '.no-state'
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

    // ensure directives are reactive
    await page.locator('button#show-all').click()
    await Promise.all(hiddenSelectors.map(selector => page.locator(selector).isVisible()))
      .then(results => results.forEach(isVisible => expect(isVisible).toBeTruthy()))

    await page.close()
  })

  it('/client-only-explicit-import', async () => {
    const html = await $fetch('/client-only-explicit-import')

    // ensure fallbacks with classes and arbitrary attributes are rendered
    expect(html).toContain('<div class="client-only-script" foo="bar">')
    expect(html).toContain('<div class="lazy-client-only-script-setup" foo="hello">')
    // ensure components are not rendered server-side
    expect(html).not.toContain('client only script')
    await expectNoClientErrors('/client-only-explicit-import')
  })

  it('client-fallback', async () => {
    const classes = [
      'clientfallback-non-stateful-setup',
      'clientfallback-non-stateful',
      'clientfallback-stateful-setup',
      'clientfallback-stateful'
    ]
    const html = await $fetch('/client-fallback')
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

    await expectNoClientErrors('/client-fallback')

    const page = await createPage('/client-fallback')
    await page.waitForLoadState('networkidle')
    // ensure components reactivity once mounted
    await page.locator('#increment-count').click()
    expect(await page.locator('#sugar-counter').innerHTML()).toContain('Sugar Counter 12 x 1 = 12')
    // keep-fallback strategy
    expect(await page.locator('#keep-fallback').all()).toHaveLength(1)
    // #20833
    expect(await page.locator('body').innerHTML()).not.toContain('Hello world !')
    await page.close()
  })

  it('/islands', async () => {
    const page = await createPage('/islands')
    await page.waitForLoadState('networkidle')
    await page.locator('#increase-pure-component').click()
    await page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)
    await page.waitForLoadState('networkidle')
    expect(await page.locator('#slot-in-server').first().innerHTML()).toContain('Slot with in .server component')
    expect(await page.locator('#test-slot').first().innerHTML()).toContain('Slot with name test')

    // test fallback slot with v-for
    expect(await page.locator('.fallback-slot-content').all()).toHaveLength(2)
    // test islands update
    expect(await page.locator('.box').innerHTML()).toContain('"number": 101,')
    await page.locator('#update-server-components').click()
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/__nuxt_island/LongAsyncComponent') && response.status() === 200),
      page.waitForResponse(response => response.url().includes('/__nuxt_island/AsyncServerComponent') && response.status() === 200)
    ])
    await page.waitForLoadState('networkidle')
    expect(await page.locator('#async-server-component-count').innerHTML()).toContain(('1'))
    expect(await page.locator('#long-async-component-count').innerHTML()).toContain('1')

    // test islands slots interactivity
    await page.locator('#first-sugar-counter button').click()
    expect(await page.locator('#first-sugar-counter').innerHTML()).toContain('Sugar Counter 13')

    // test islands mounted client side with slot
    await page.locator('#show-island').click()
    await page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)
    await page.waitForLoadState('networkidle')
    expect(await page.locator('#island-mounted-client-side').innerHTML()).toContain('Interactive testing slot post SSR')

    await page.close()
  })

  it('/legacy-async-data-fail', async () => {
    const response = await fetch('/legacy-async-data-fail').then(r => r.text())
    expect(response).not.toContain('don\'t look at this')
    expect(response).toContain('OH NNNNNNOOOOOOOOOOO')
  })
})

describe('nuxt composables', () => {
  it('has useRequestURL()', async () => {
    const html = await $fetch('/url')
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
          'browser-set-to-null-with-default': 'provided-by-browser'
        }).map(([key, value]) => `${key}=${value}`).join('; ')
      }
    })
    const cookies = res.headers.get('set-cookie')
    expect(cookies).toMatchInlineSnapshot('"set-in-plugin=true; Path=/, set=set; Path=/, browser-set=set; Path=/, browser-set-to-null=; Max-Age=0; Path=/, browser-set-to-null-with-default=; Max-Age=0; Path=/"')
  })
})

describe('rich payloads', () => {
  it('correctly serializes and revivifies complex types', async () => {
    const html = await $fetch('/json-payload')
    for (const test of [
      'Date: true',
      'Recursive objects: true',
      'Shallow reactive: true',
      'Shallow ref: true',
      'Undefined ref: true',
      'Reactive: true',
      'Ref: true',
      'Error: true'
    ]) {
      expect(html).toContain(test)
    }
  })
})

describe('nuxt links', () => {
  it('handles trailing slashes', async () => {
    const html = await $fetch('/nuxt-link/trailing-slash')
    const data: Record<string, string[]> = {}
    for (const selector of ['nuxt-link', 'router-link', 'link-with-trailing-slash', 'link-without-trailing-slash']) {
      data[selector] = []
      for (const match of html.matchAll(new RegExp(`href="([^"]*)"[^>]*class="[^"]*\\b${selector}\\b`, 'g'))) {
        data[selector].push(match[1])
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

  it('preserves route state', async () => {
    const page = await createPage('/nuxt-link/trailing-slash')
    await page.waitForLoadState('networkidle')

    for (const selector of ['nuxt-link', 'router-link', 'link-with-trailing-slash', 'link-without-trailing-slash']) {
      await page.locator(`.${selector}[href*=with-state]`).click()
      await page.waitForLoadState('networkidle')
      expect(await page.getByTestId('window-state').innerText()).toContain('bar')

      await page.locator(`.${selector}[href*=without-state]`).click()
      await page.waitForLoadState('networkidle')
      expect(await page.getByTestId('window-state').innerText()).not.toContain('bar')
    }

    await page.close()
  })
})

describe('head tags', () => {
  it('SSR should render tags', async () => {
    const headHtml = await $fetch('/head')

    expect(headHtml).toContain('<title>Using a dynamic component - Title Template Fn Change</title>')
    expect(headHtml).not.toContain('<meta name="description" content="first">')
    expect(headHtml).toContain('<meta charset="utf-16">')
    expect(headHtml.match('meta charset').length).toEqual(1)
    expect(headHtml).toContain('<meta name="viewport" content="width=1024, initial-scale=1">')
    expect(headHtml.match('meta name="viewport"').length).toEqual(1)
    expect(headHtml).not.toContain('<meta charset="utf-8">')
    expect(headHtml).toContain('<meta name="description" content="overriding with an inline useHead call">')
    expect(headHtml).toMatch(/<html[^>]*class="html-attrs-test"/)
    expect(headHtml).toMatch(/<body[^>]*class="body-attrs-test"/)
    expect(headHtml).toContain('<script src="https://a-body-appended-script.com"></script></body>')

    const indexHtml = await $fetch('/')
    // should render charset by default
    expect(indexHtml).toContain('<meta charset="utf-8">')
    // should render <Head> components
    expect(indexHtml).toContain('<title>Basic fixture</title>')
  })

  it('SSR script setup should render tags', async () => {
    const headHtml = await $fetch('/head-script-setup')

    // useHead - title & titleTemplate are working
    expect(headHtml).toContain('<title>head script setup - Nuxt Playground</title>')
    // useSeoMeta - template params
    expect(headHtml).toContain('<meta property="og:title" content="head script setup - Nuxt Playground">')
    // useSeoMeta - refs
    expect(headHtml).toContain('<meta name="description" content="head script setup description for Nuxt Playground">')
    // useServerHead - shorthands
    expect(headHtml).toContain('>/* Custom styles */</style>')
    // useHeadSafe - removes dangerous content
    expect(headHtml).toContain('<script id="xss-script"></script>')
    expect(headHtml).toContain('<meta content="0;javascript:alert(1)">')
  })

  it('SPA should render appHead tags', async () => {
    const headHtml = await $fetch('/head', { headers: { 'x-nuxt-no-ssr': '1' } })

    expect(headHtml).toContain('<meta name="description" content="Nuxt Fixture">')
    expect(headHtml).toContain('<meta charset="utf-8">')
    expect(headHtml).toContain('<meta name="viewport" content="width=1024, initial-scale=1">')
  })

  it('legacy vueuse/head works', async () => {
    const headHtml = await $fetch('/vueuse-head')
    expect(headHtml).toContain('<title>using provides usehead and updateDOM - VueUse head polyfill test</title>')
  })

  it('should render http-equiv correctly', async () => {
    const html = await $fetch('/head')
    // http-equiv should be rendered kebab case
    expect(html).toContain('<meta content="default-src https" http-equiv="content-security-policy">')
  })

  // TODO: Doesn't adds header in test environment
  // it.todo('should render stylesheet link tag (SPA mode)', async () => {
  //   const html = await $fetch('/head', { headers: { 'x-nuxt-no-ssr': '1' } })
  //   expect(html).toMatch(/<link rel="stylesheet" href="\/_nuxt\/[^>]*.css"/)
  // })
})

describe('legacy async data', () => {
  it('should work with defineNuxtComponent', async () => {
    const html = await $fetch('/legacy/async-data')
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
    expect(await res.text()).toMatchInlineSnapshot('"<!DOCTYPE html><html><head><meta http-equiv=\\"refresh\\" content=\\"0; url=/navigate-some-path\\"></head></html>"')
  })

  it('should not overwrite headers', async () => {
    const { headers, status } = await fetch('/navigate-to-external', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/')
    expect(status).toEqual(302)
  })

  it('supports directly aborting navigation on SSR', async () => {
    const { status } = await fetch('/navigate-to-false', { redirect: 'manual' })

    expect(status).toEqual(404)
  })
})

describe('preserves current instance', () => {
  it('should not return getCurrentInstance when there\'s an error in data', async () => {
    await fetch('/instance/error')
    const html = await $fetch('/instance/next-request')
    expect(html).toContain('This should be false: false')
  })
  // TODO: re-enable when https://github.com/nuxt/nuxt/issues/15164 is resolved
  it.skipIf(isWindows)('should not lose current nuxt app after await in vue component', async () => {
    const requests = await Promise.all(Array.from({ length: 100 }).map(() => $fetch('/instance/next-request')))
    for (const html of requests) {
      expect(html).toContain('This should be true: true')
    }
  })
})

describe('errors', () => {
  it('should render a JSON error page', async () => {
    const res = await fetch('/error', {
      headers: {
        accept: 'application/json'
      }
    })
    expect(res.status).toBe(422)
    expect(res.statusText).toBe('This is a custom error')
    const error = await res.json()
    delete error.stack
    expect(error).toMatchObject({
      message: 'This is a custom error',
      statusCode: 422,
      statusMessage: 'This is a custom error',
      url: '/error'
    })
  })

  it('should render a HTML error page', async () => {
    const res = await fetch('/error')
    // TODO: remove when we update CI to node v18
    if (process.version.startsWith('v16')) {
      expect(res.headers.get('Set-Cookie')).toBe('set-in-plugin=true; Path=/')
    } else {
      expect(res.headers.get('Set-Cookie')).toBe('set-in-plugin=true; Path=/, some-error=was%20set; Path=/')
    }
    expect(await res.text()).toContain('This is a custom error')
  })

  it('should not allow accessing error route directly', async () => {
    const res = await fetch('/__nuxt_error', {
      headers: {
        accept: 'application/json'
      }
    })
    expect(res.status).toBe(404)
    const error = await res.json()
    delete error.stack
    expect(error).toMatchInlineSnapshot(`
      {
        "message": "Page Not Found: /__nuxt_error",
        "statusCode": 404,
        "statusMessage": "Page Not Found: /__nuxt_error",
        "url": "/__nuxt_error",
      }
    `)
  })

  // TODO: need to create test for webpack
  it.runIf(!isDev() && !isWebpack)('should handle chunk loading errors', async () => {
    const { page, consoleLogs } = await renderPage('/')
    await page.getByText('Increment state').click()
    await page.getByText('Increment state').click()
    expect(await page.innerText('div')).toContain('Some value: 3')
    await page.getByText('Chunk error').click()
    await page.waitForURL(url('/chunk-error'))
    expect(consoleLogs.map(c => c.text).join('')).toContain('caught chunk load error')
    expect(await page.innerText('div')).toContain('Chunk error page')
    await page.waitForLoadState('networkidle')
    expect(await page.innerText('div')).toContain('State: 3')

    await page.close()
  })
})

describe('navigate external', () => {
  it('should redirect to example.com', async () => {
    const { headers } = await fetch('/navigate-to-external/', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('https://example.com/')
  })

  it('should redirect to api endpoint', async () => {
    const { headers } = await fetch('/navigate-to-api', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/api/test')
  })
})

describe('middlewares', () => {
  it('should redirect to index with global middleware', async () => {
    const html = await $fetch('/redirect/')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('Hello Nuxt 3!')
  })

  it('should allow aborting navigation on server-side', async () => {
    const res = await fetch('/?abort', {
      headers: {
        accept: 'application/json'
      }
    })
    expect(res.status).toEqual(401)
  })

  it('should allow aborting navigation fatally on client-side', async () => {
    const html = await $fetch('/middleware-abort')
    expect(html).not.toContain('This is the error page')
    const page = await createPage('/middleware-abort')
    await page.waitForLoadState('networkidle')
    expect(await page.innerHTML('body')).toContain('This is the error page')
    await page.close()
  })

  it('should inject auth', async () => {
    const html = await $fetch('/auth')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('auth.vue')
    expect(html).toContain('auth: Injected by injectAuth middleware')
  })

  it('should not inject auth', async () => {
    const html = await $fetch('/no-auth')

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
    const html = await $fetch('/plugins')
    expect(html).toContain('myPlugin: Injected by my-plugin')
  })

  it('async plugin', async () => {
    const html = await $fetch('/plugins')
    expect(html).toContain('asyncPlugin: Async plugin works! 123')
    expect(html).toContain('useFetch works!')
  })
})

describe('layouts', () => {
  it('should apply custom layout', async () => {
    const html = await $fetch('/with-layout')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('with-layout.vue')
    expect(html).toContain('Custom Layout:')
  })
  it('should work with a dynamically set layout', async () => {
    const html = await $fetch('/with-dynamic-layout')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('with-dynamic-layout')
    expect(html).toContain('Custom Layout:')
    await expectNoClientErrors('/with-dynamic-layout')
  })
  it('should work with a computed layout', async () => {
    const html = await $fetch('/with-computed-layout')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('with-computed-layout')
    expect(html).toContain('Custom Layout')
    await expectNoClientErrors('/with-computed-layout')
  })
  it('should allow passing custom props to a layout', async () => {
    const html = await $fetch('/layouts/with-props')
    expect(html).toContain('some prop was passed')
    await expectNoClientErrors('/layouts/with-props')
  })
})

describe('reactivity transform', () => {
  it('should works', async () => {
    const html = await $fetch('/')

    expect(html).toContain('Sugar Counter 12 x 2 = 24')
  })
})

describe('composable tree shaking', () => {
  it('should work', async () => {
    const html = await $fetch('/tree-shake')

    expect(html).toContain('Tree Shake Example')

    const page = await createPage('/tree-shake')
    // check page doesn't have any errors or warnings in the console
    await page.waitForLoadState('networkidle')
    // ensure scoped classes are correctly assigned between client and server
    expect(await page.$eval('h1', e => getComputedStyle(e).color)).toBe('rgb(255, 192, 203)')

    await expectNoClientErrors('/tree-shake')

    await page.close()
  })
})

describe('server tree shaking', () => {
  it('should work', async () => {
    const html = await $fetch('/client')

    expect(html).toContain('This page should not crash when rendered')
    expect(html).toContain('fallback for ClientOnly')
    expect(html).not.toContain('rendered client-side')
    expect(html).not.toContain('id="client-side"')

    const page = await createPage('/client')
    await page.waitForLoadState('networkidle')
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
      const html = await $fetch('/foo')
      expect(html).toContain('Extended layout from foo')
      expect(html).toContain('Extended page from foo')
    })

    it('extends [bar/layouts/override & bar/pages/override] over [foo/layouts/override & foo/pages/override]', async () => {
      const html = await $fetch('/override')
      expect(html).toContain('Extended layout from bar')
      expect(html).toContain('Extended page from bar')
    })
  })

  describe('components', () => {
    it('extends foo/components/ExtendsFoo', async () => {
      const html = await $fetch('/foo')
      expect(html).toContain('Extended component from foo')
    })

    it('extends bar/components/ExtendsOverride over foo/components/ExtendsOverride', async () => {
      const html = await $fetch('/override')
      expect(html).toContain('Extended component from bar')
    })
  })

  describe('middlewares', () => {
    it('works with layer aliases', async () => {
      const html = await $fetch('/foo')
      expect(html).toContain('from layer alias')
    })
    it('extends foo/middleware/foo', async () => {
      const html = await $fetch('/foo')
      expect(html).toContain('Middleware | foo: Injected by extended middleware from foo')
    })

    it('extends bar/middleware/override over foo/middleware/override', async () => {
      const html = await $fetch('/override')
      expect(html).toContain('Middleware | override: Injected by extended middleware from bar')
    })
  })

  describe('composables', () => {
    it('extends foo/composables/foo', async () => {
      const html = await $fetch('/foo')
      expect(html).toContain('Composable | useExtendsFoo: foo')
    })
    it('allows overriding composables', async () => {
      const html = await $fetch('/extends')
      expect(html).toContain('test from project')
    })
  })

  describe('plugins', () => {
    it('extends foo/plugins/foo', async () => {
      const html = await $fetch('/foo')
      expect(html).toContain('Plugin | foo: String generated from foo plugin!')
    })
  })

  describe('server', () => {
    it('extends foo/server/api/foo', async () => {
      expect(await $fetch('/api/foo')).toBe('foo')
    })

    it('extends foo/server/middleware/foo', async () => {
      const { headers } = await fetch('/')
      expect(headers.get('injected-header')).toEqual('foo')
    })
  })

  describe('app', () => {
    it('extends foo/app/router.options & bar/app/router.options', async () => {
      const html: string = await $fetch('/')
      const routerLinkClasses = html.match(/href="\/" class="([^"]*)"/)?.[1].split(' ')
      expect(routerLinkClasses).toContain('foo-active-class')
      expect(routerLinkClasses).toContain('bar-exact-active-class')
    })
  })
})

// Bug #7337
describe('deferred app suspense resolve', () => {
  async function behaviour (path: string) {
    await withLogs(async (page, logs) => {
      await page.goto(url(path))
      await page.waitForLoadState('networkidle')

      // Wait for all pending micro ticks to be cleared in case hydration haven't finished yet.
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

      const hydrationLogs = logs.filter(log => log.includes('isHydrating'))
      expect(hydrationLogs.length).toBe(3)
      expect(hydrationLogs.every(log => log === 'isHydrating: true'))
    })
  }
  it('should wait for all suspense instance on initial hydration', async () => {
    await behaviour('/async-parent/child')
  })
  it('should wait for all suspense instance on initial hydration', async () => {
    await behaviour('/internal-layout/async-parent/child')
  })
})

describe('nested suspense', () => {
  const navigations = [
    ['/suspense/sync-1/async-1/', '/suspense/sync-2/async-1/'],
    ['/suspense/sync-1/sync-1/', '/suspense/sync-2/async-1/'],
    ['/suspense/async-1/async-1/', '/suspense/async-2/async-1/'],
    ['/suspense/async-1/sync-1/', '/suspense/async-2/async-1/']
  ]

  it.each(navigations)('should navigate from %s to %s with no white flash', async (start, nav) => {
    const page = await createPage(start, {})
    await page.waitForLoadState('networkidle')

    const slug = nav.replace(/[/-]+/g, '-')
    await page.click(`[href^="${nav}"]`)

    const text = await page.waitForFunction(slug => document.querySelector(`#${slug}`)?.innerHTML, slug)
      // @ts-expect-error TODO: fix upstream in playwright - types for evaluate are broken
      .then(r => r.evaluate(r => r))

    // expect(text).toMatchInlineSnapshot()

    // const parent = await page.waitForSelector(`#${slug}`, { state: 'attached' })

    // const text = await parent.innerText()
    expect(text).toContain('Async child: 2 - 1')

    await page.close()
  })
})

// Bug #6592
describe('page key', () => {
  it('should not cause run of setup if navigation not change page key and layout', async () => {
    async function behaviour (path: string) {
      await withLogs(async (page, logs) => {
        await page.goto(url(`${path}/0`))
        await page.waitForLoadState('networkidle')

        await page.click(`[href="${path}/1"]`)
        await page.waitForSelector('#page-1')

        // Wait for all pending micro ticks to be cleared,
        // so we are not resolved too early when there are repeated page loading
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

        expect(logs.filter(l => l.includes('Child Setup')).length).toBe(1)
      })
    }
    await behaviour('/fixed-keyed-child-parent')
    await behaviour('/internal-layout/fixed-keyed-child-parent')
  })
  it('will cause run of setup if navigation changed page key', async () => {
    async function behaviour (path: string) {
      await withLogs(async (page, logs) => {
        await page.goto(url(`${path}/0`))
        await page.waitForLoadState('networkidle')

        await page.click(`[href="${path}/1"]`)
        await page.waitForSelector('#page-1')

        // Wait for all pending micro ticks to be cleared,
        // so we are not resolved too early when there are repeated page loading
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

        expect(logs.filter(l => l.includes('Child Setup')).length).toBe(2)
      })
    }
    await behaviour('/keyed-child-parent')
    await behaviour('/internal-layout/keyed-child-parent')
  })
})

// Bug #6592
describe('layout change not load page twice', () => {
  async function behaviour (path1: string, path2: string) {
    await withLogs(async (page, logs) => {
      await page.goto(url(path1))
      await page.waitForLoadState('networkidle')
      await page.click(`[href="${path2}"]`)
      await page.waitForSelector('#with-layout2')

      // Wait for all pending micro ticks to be cleared,
      // so we are not resolved too early when there are repeated page loading
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

      expect(logs.filter(l => l.includes('Layout2 Page Setup')).length).toBe(1)
    })
  }
  it('should not cause run of page setup to repeat if layout changed', async () => {
    await behaviour('/with-layout', '/with-layout2')
    await behaviour('/internal-layout/with-layout', '/internal-layout/with-layout2')
  })
})

describe('automatically keyed composables', () => {
  it('should automatically generate keys', async () => {
    const html = await $fetch('/keyed-composables')
    expect(html).toContain('true')
    expect(html).not.toContain('false')
  })
  it('should match server-generated keys', async () => {
    await expectNoClientErrors('/keyed-composables')
  })
  it('should not automatically generate keys', async () => {
    await expectNoClientErrors('/keyed-composables/local')
    const html = await $fetch('/keyed-composables/local')
    expect(html).toContain('true')
    expect(html).not.toContain('false')
  })
})

describe.skipIf(isDev() || isWebpack)('inlining component styles', () => {
  it('should inline styles', async () => {
    const html = await $fetch('/styles')
    for (const style of [
      '{--assets:"assets"}', // <script>
      '{--scoped:"scoped"}', // <style lang=css>
      '{--postcss:"postcss"}' // <style lang=postcss>
    ]) {
      expect(html).toContain(style)
    }
  })

  it('does not load stylesheet for page styles', async () => {
    const html: string = await $fetch('/styles')
    expect(html.match(/<link [^>]*href="[^"]*\.css">/g)?.filter(m => m.includes('entry'))?.map(m => m.replace(/\.[^.]*\.css/, '.css'))).toMatchInlineSnapshot(`
      [
        "<link rel=\\"preload\\" as=\\"style\\" href=\\"/_nuxt/entry.css\\">",
        "<link rel=\\"stylesheet\\" href=\\"/_nuxt/entry.css\\">",
      ]
    `)
  })

  it('still downloads client-only styles', async () => {
    const page = await createPage('/styles')
    await page.waitForLoadState('networkidle')
    expect(await page.$eval('.client-only-css', e => getComputedStyle(e).color)).toBe('rgb(50, 50, 50)')

    await page.close()
  })

  it.todo('renders client-only styles only', async () => {
    const html = await $fetch('/styles')
    expect(html).toContain('{--client-only:"client-only"}')
  })
})

describe('prefetching', () => {
  it('should prefetch components', async () => {
    await expectNoClientErrors('/prefetch/components')
  })
  it('should not prefetch certain dynamic imports by default', async () => {
    const html = await $fetch('/auth')
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
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))
    await expectWithPolling(
      () => consoleLogs
        .map(w => w.text).join('\n')
        .includes('does not have a single root node and will cause errors when navigating between routes'),
      true
    )

    await page.close()
  })

  it.each(['fine'])('should not complain if there is no transition (%s)', async (path) => {
    const { consoleLogs, page } = await renderPage(joinURL('/invalid-root', path))
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)))

    const consoleLogsWarns = consoleLogs.filter(i => i.type === 'warning')
    expect(consoleLogsWarns.length).toEqual(0)

    await page.close()
  })
})

// TODO: dynamic paths in dev
describe.skipIf(isDev())('dynamic paths', () => {
  it('should work with no overrides', async () => {
    const html: string = await $fetch('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*?)\)/g)) {
      const url = match[2] || match[3]
      expect(url.startsWith('/_nuxt/') || url === '/public.svg').toBeTruthy()
    }
  })

  // webpack injects CSS differently
  it.skipIf(isWebpack)('adds relative paths to CSS', async () => {
    const html: string = await $fetch('/assets')
    const urls = Array.from(html.matchAll(/(href|src)="(.*?)"|url\(([^)]*?)\)/g)).map(m => m[2] || m[3])
    const cssURL = urls.find(u => /_nuxt\/assets.*\.css$/.test(u))
    expect(cssURL).toBeDefined()
    const css: string = await $fetch(cssURL!)
    const imageUrls = Array.from(css.matchAll(/url\(([^)]*)\)/g)).map(m => m[1].replace(/[-.][\w]{8}\./g, '.'))
    expect(imageUrls).toMatchInlineSnapshot(`
        [
          "./logo.svg",
          "../public.svg",
          "../public.svg",
          "../public.svg",
        ]
      `)
  })

  it('should allow setting base URL and build assets directory', async () => {
    process.env.NUXT_APP_BUILD_ASSETS_DIR = '/_other/'
    process.env.NUXT_APP_BASE_URL = '/foo/'
    await startServer()

    const html = await $fetch('/foo/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*?)\)/g)) {
      const url = match[2] || match[3]
      expect(
        url.startsWith('/foo/_other/') ||
        url === '/foo/public.svg' ||
        // TODO: webpack does not yet support dynamic static paths
        (isWebpack && url === '/public.svg')
      ).toBeTruthy()
    }
  })

  it('should allow setting relative baseURL', async () => {
    delete process.env.NUXT_APP_BUILD_ASSETS_DIR
    process.env.NUXT_APP_BASE_URL = './'
    await startServer()

    const html = await $fetch('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*?)\)/g)) {
      const url = match[2] || match[3]
      expect(
        url.startsWith('./_nuxt/') ||
        url === './public.svg' ||
        // TODO: webpack does not yet support dynamic static paths
        (isWebpack && url === '/public.svg')
      ).toBeTruthy()
      expect(url.startsWith('./_nuxt/_nuxt')).toBeFalsy()
    }
  })

  it('should use baseURL when redirecting', async () => {
    process.env.NUXT_APP_BUILD_ASSETS_DIR = '/_other/'
    process.env.NUXT_APP_BASE_URL = '/foo/'
    await startServer()
    const { headers } = await fetch('/foo/navigate-to/', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/foo/')
  })

  it('should allow setting CDN URL', async () => {
    process.env.NUXT_APP_BASE_URL = '/foo/'
    process.env.NUXT_APP_CDN_URL = 'https://example.com/'
    process.env.NUXT_APP_BUILD_ASSETS_DIR = '/_cdn/'
    await startServer()

    const html = await $fetch('/foo/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*?)\)/g)) {
      const url = match[2] || match[3]
      expect(
        url.startsWith('https://example.com/_cdn/') ||
        url === 'https://example.com/public.svg' ||
        // TODO: webpack does not yet support dynamic static paths
        (isWebpack && url === '/public.svg')
      ).toBeTruthy()
    }
  })

  it('restore server', async () => {
    process.env.NUXT_APP_BASE_URL = undefined
    process.env.NUXT_APP_CDN_URL = undefined
    process.env.NUXT_APP_BUILD_ASSETS_DIR = undefined
    await startServer()
  })
})

describe('app config', () => {
  it('should work', async () => {
    const html = await $fetch('/app-config')

    const expectedAppConfig = {
      fromNuxtConfig: true,
      nested: {
        val: 2
      },
      fromLayer: true,
      userConfig: 123
    }

    expect(html).toContain(JSON.stringify(expectedAppConfig))

    const serverAppConfig = await $fetch('/api/app-config')
    expect(serverAppConfig).toMatchObject({ appConfig: expectedAppConfig })
  })
})

describe('component islands', () => {
  it('renders components with route', async () => {
    const result: NuxtIslandResponse = await $fetch('/__nuxt_island/RouteComponent?url=/foo')

    if (isDev()) {
      result.head.link = result.head.link.filter(l => !l.href.includes('@nuxt+ui-templates') && (l.href.startsWith('_nuxt/components/islands/') && l.href.includes('_nuxt/components/islands/RouteComponent')))
    }

    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<pre nuxt-ssr-component-uid>    Route: /foo
        </pre>",
        "state": {},
      }
    `)
  })

  it('render async component', async () => {
    const result: NuxtIslandResponse = await $fetch(withQuery('/__nuxt_island/LongAsyncComponent', {
      props: JSON.stringify({
        count: 3
      })
    }))
    if (isDev()) {
      result.head.link = result.head.link.filter(l => !l.href.includes('@nuxt+ui-templates') && (l.href.startsWith('_nuxt/components/islands/') && l.href.includes('_nuxt/components/islands/LongAsyncComponent')))
    }
    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<div nuxt-ssr-component-uid><div> count is above 2 </div><div style=\\"display:contents;\\" nuxt-ssr-slot-name=\\"default\\"></div> that was very long ... <div id=\\"long-async-component-count\\">3</div><div style=\\"display:contents;\\" nuxt-ssr-slot-name=\\"test\\" nuxt-ssr-slot-data=\\"[{&quot;count&quot;:3}]\\"></div><p>hello world !!!</p><div style=\\"display:contents;\\" nuxt-ssr-slot-name=\\"hello\\" nuxt-ssr-slot-data=\\"[{&quot;t&quot;:0},{&quot;t&quot;:1},{&quot;t&quot;:2}]\\"><div nuxt-slot-fallback-start=\\"hello\\"></div><!--[--><div style=\\"display:contents;\\"><div> fallback slot -- index: 0</div></div><div style=\\"display:contents;\\"><div> fallback slot -- index: 1</div></div><div style=\\"display:contents;\\"><div> fallback slot -- index: 2</div></div><!--]--><div nuxt-slot-fallback-end></div></div><div style=\\"display:contents;\\" nuxt-ssr-slot-name=\\"fallback\\" nuxt-ssr-slot-data=\\"[{&quot;t&quot;:&quot;fall&quot;},{&quot;t&quot;:&quot;back&quot;}]\\"><div nuxt-slot-fallback-start=\\"fallback\\"></div><!--[--><div style=\\"display:contents;\\"><div>fall slot -- index: 0</div><div class=\\"fallback-slot-content\\"> wonderful fallback </div></div><div style=\\"display:contents;\\"><div>back slot -- index: 1</div><div class=\\"fallback-slot-content\\"> wonderful fallback </div></div><!--]--><div nuxt-slot-fallback-end></div></div></div>",
        "state": {},
      }
    `)
  })

  it('render .server async component', async () => {
    const result: NuxtIslandResponse = await $fetch(withQuery('/__nuxt_island/AsyncServerComponent', {
      props: JSON.stringify({
        count: 2
      })
    }))
    if (isDev()) {
      result.head.link = result.head.link.filter(l => !l.href.includes('@nuxt+ui-templates') && (l.href.startsWith('_nuxt/components/islands/') && l.href.includes('_nuxt/components/islands/AsyncServerComponent')))
    }
    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<div nuxt-ssr-component-uid> This is a .server (20ms) async component that was very long ... <div id=\\"async-server-component-count\\">2</div><div style=\\"display:contents;\\" nuxt-ssr-slot-name=\\"default\\"></div></div>",
        "state": {},
      }
    `)
  })

  it('renders pure components', async () => {
    const result: NuxtIslandResponse = await $fetch(withQuery('/__nuxt_island/PureComponent', {
      props: JSON.stringify({
        bool: false,
        number: 3487,
        str: 'something',
        obj: { foo: 42, bar: false, me: 'hi' }
      })
    }))
    result.html = result.html.replace(/ nuxt-ssr-component-uid="([^"]*)"/g, '')

    if (isDev()) {
      result.head.link = result.head.link.filter(l => !l.href.includes('@nuxt+ui-templates'))
      const fixtureDir = normalize(fileURLToPath(new URL('./fixtures/basic', import.meta.url)))
      for (const link of result.head.link) {
        link.href = link.href.replace(fixtureDir, '/<rootDir>').replaceAll('//', '/')
        link.key = link.key.replace(/-[a-zA-Z0-9]+$/, '')
      }
    }
    result.head.style = result.head.style.map(s => ({
      ...s,
      innerHTML: (s.innerHTML || '').replace(/data-v-[a-z0-9]+/, 'data-v-xxxxx'),
      key: s.key.replace(/-[a-zA-Z0-9]+$/, '')
    }))

    // TODO: fix rendering of styles in webpack
    if (!isDev() && !isWebpack) {
      expect(result.head).toMatchInlineSnapshot(`
        {
          "link": [],
          "style": [
            {
              "innerHTML": "pre[data-v-xxxxx]{color:blue}",
              "key": "island-style",
            },
          ],
        }
    `)
    } else if (isDev() && !isWebpack) {
      expect(result.head).toMatchInlineSnapshot(`
        {
          "link": [
            {
              "href": "/_nuxt/components/islands/PureComponent.vue?vue&type=style&index=0&scoped=c0c0cf89&lang.css",
              "key": "island-link",
              "rel": "stylesheet",
            },
          ],
          "style": [],
        }
      `)
    }

    expect(result.html.replace(/data-v-\w+|"|<!--.*-->/g, '')).toMatchInlineSnapshot(`
      "<div nuxt-ssr-component-uid > Was router enabled: true <br > Props: <pre >{
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

    expect(result.state).toMatchInlineSnapshot(`
      {
        "$shasRouter": true,
      }
    `)
  })

  it('test client-side navigation', async () => {
    const page = await createPage('/')
    await page.waitForLoadState('networkidle')
    await page.click('#islands')
    await page.waitForLoadState('networkidle')
    await page.locator('#increase-pure-component').click()
    await page.waitForResponse(response => response.url().includes('/__nuxt_island/') && response.status() === 200)
    await page.waitForLoadState('networkidle')
    expect(await page.locator('#slot-in-server').first().innerHTML()).toContain('Slot with in .server component')
    expect(await page.locator('#test-slot').first().innerHTML()).toContain('Slot with name test')

    // test islands update
    expect(await page.locator('.box').innerHTML()).toContain('"number": 101,')
    await page.locator('#update-server-components').click()
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/__nuxt_island/LongAsyncComponent') && response.status() === 200),
      page.waitForResponse(response => response.url().includes('/__nuxt_island/AsyncServerComponent') && response.status() === 200)
    ])
    await page.waitForLoadState('networkidle')
    expect(await page.locator('#async-server-component-count').innerHTML()).toContain(('1'))
    expect(await page.locator('#long-async-component-count').innerHTML()).toContain('1')

    // test islands slots interactivity
    await page.locator('#first-sugar-counter button').click()
    expect(await page.locator('#first-sugar-counter').innerHTML()).toContain('Sugar Counter 13')

    await page.close()
  })
})

describe.runIf(isDev() && !isWebpack)('vite plugins', () => {
  it('does not override vite plugins', async () => {
    expect(await $fetch('/vite-plugin-without-path')).toBe('vite-plugin without path')
    expect(await $fetch('/__nuxt-test')).toBe('vite-plugin with __nuxt prefix')
  })
  it('does not allow direct access to nuxt source folder', async () => {
    expect(await $fetch('/app.config')).toContain('catchall at')
  })
})

describe.skipIf(isDev() || isWindows || !isRenderingJson)('payload rendering', () => {
  it('renders a payload', async () => {
    const payload = await $fetch('/random/a/_payload.json', { responseType: 'text' })
    const data = parsePayload(payload)
    expect(typeof data.prerenderedAt).toEqual('number')

    expect(data.data).toMatchObject({
      hey: {
        baz: 'qux',
        foo: 'bar'
      },
      rand_a: expect.arrayContaining([expect.anything()])
    })
  })

  it('does not fetch a prefetched payload', async () => {
    const page = await createPage()
    const requests = [] as string[]

    page.on('request', (req) => {
      requests.push(req.url().replace(url('/'), '/'))
    })

    await page.goto(url('/random/a'))
    await page.waitForLoadState('networkidle')

    // We are manually prefetching other payloads
    expect(requests).toContain('/random/c/_payload.json')

    // We are not triggering API requests in the payload
    expect(requests).not.toContain(expect.stringContaining('/api/random'))
    expect(requests).not.toContain(expect.stringContaining('/__nuxt_island'))
    // requests.length = 0

    await page.click('[href="/random/b"]')
    await page.waitForLoadState('networkidle')

    // We are not triggering API requests in the payload in client-side nav
    expect(requests).not.toContain('/api/random')
    expect(requests).not.toContain(expect.stringContaining('/__nuxt_island'))

    // We are fetching a payload we did not prefetch
    expect(requests).toContain('/random/b/_payload.json')

    // We are not refetching payloads we've already prefetched
    // expect(requests.filter(p => p.includes('_payload')).length).toBe(1)
    // requests.length = 0

    await page.click('[href="/random/c"]')
    await page.waitForLoadState('networkidle')

    // We are not triggering API requests in the payload in client-side nav
    expect(requests).not.toContain('/api/random')
    expect(requests).not.toContain(expect.stringContaining('/__nuxt_island'))

    // We are not refetching payloads we've already prefetched
    // Note: we refetch on dev as urls differ between '' and '?import'
    // expect(requests.filter(p => p.includes('_payload')).length).toBe(isDev() ? 1 : 0)

    await page.close()
  })
})

describe.skipIf(isWindows)('useAsyncData', () => {
  it('single request resolves', async () => {
    await expectNoClientErrors('/useAsyncData/single')
  })

  it('two requests resolve', async () => {
    await expectNoClientErrors('/useAsyncData/double')
  })

  it('two requests resolve and sync', async () => {
    await $fetch('/useAsyncData/refresh')
  })

  it('requests can be cancelled/overridden', async () => {
    await expectNoClientErrors('/useAsyncData/override')
  })

  it('two requests made at once resolve and sync', async () => {
    await expectNoClientErrors('/useAsyncData/promise-all')
  })
})

describe.runIf(isDev())('component testing', () => {
  it('should work', async () => {
    const comp1 = await $fetchComponent('components/SugarCounter.vue', { multiplier: 2 })
    expect(comp1).toContain('12 x 2 = 24')

    const comp2 = await $fetchComponent('components/SugarCounter.vue', { multiplier: 4 })
    expect(comp2).toContain('12 x 4 = 48')
  })
})
