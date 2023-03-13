import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { joinURL, withQuery } from 'ufo'
import { isCI, isWindows } from 'std-env'
import { normalize } from 'pathe'
import { setup, fetch, $fetch, startServer, isDev, createPage, url } from '@nuxt/test-utils'

import type { NuxtIslandResponse } from '../packages/nuxt/src/core/runtime/nitro/renderer'
import { expectNoClientErrors, expectWithPolling, renderPage, withLogs } from './utils'

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
    expect(await $fetch('/route-rules/spa')).toContain('serverRendered:false')
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
    // should apply attributes to client-only components
    expect(html).toContain('<div style="color:red;" class="client-only"></div>')
    // should render server-only components
    expect(html).toContain('<div class="server-only" style="background-color:gray;"> server-only component </div>')
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

  it('validates routes', async () => {
    const { status } = await fetch('/forbidden')
    expect(status).toEqual(404)

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

  it('render 404', async () => {
    const html = await $fetch('/not-found')

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

    await page.close()
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
    expect(html).toContain('{hello:"Hello API"}')
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
})

describe('errors', () => {
  it('should render a JSON error page', async () => {
    const res = await fetch('/error', {
      headers: {
        accept: 'application/json'
      }
    })
    expect(res.status).toBe(422)
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
    expect(await res.text()).toContain('This is a custom error')
  })

  // TODO: need to create test for webpack
  it.runIf(!isDev() && !isWebpack)('should handle chunk loading errors', async () => {
    const { page, consoleLogs } = await renderPage('/')
    await page.getByText('Increment state').click()
    await page.getByText('Increment state').click()
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
      result.head.link = result.head.link.filter(l => !l.href.includes('@nuxt+ui-templates'))
    }

    expect(result).toMatchInlineSnapshot(`
      {
        "head": {
          "link": [],
          "style": [],
        },
        "html": "<pre>    Route: /foo
        </pre>",
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
    "<div > Was router enabled: true <br > Props: <pre >{
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

describe.skipIf(isDev() || isWindows)('payload rendering', () => {
  it('renders a payload', async () => {
    const payload = await $fetch('/random/a/_payload.js', { responseType: 'text' })
    expect(payload).toMatch(
      /export default \{data:\{hey:\{[^}]*\},rand_a:\[[^\]]*\],".*":\{html:".*server-only component.*",head:\{link:\[\],style:\[\]\}\}\},prerenderedAt:\d*\}/
    )
  })

  it('does not fetch a prefetched payload', async () => {
    const page = await createPage()
    const requests = [] as string[]

    page.on('request', (req) => {
      requests.push(req.url().replace(url('/'), '/'))
    })

    await page.goto(url('/random/a'))
    await page.waitForLoadState('networkidle')

    const importSuffix = isDev() && !isWebpack ? '?import' : ''

    // We are manually prefetching other payloads
    expect(requests).toContain('/random/c/_payload.js')

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
    expect(requests).toContain('/random/b/_payload.js' + importSuffix)

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
