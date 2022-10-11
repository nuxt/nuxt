import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'
import { isWindows } from 'std-env'
import { setup, fetch, $fetch, startServer, createPage, url } from '@nuxt/test-utils'
// eslint-disable-next-line import/order
import { expectNoClientErrors, renderPage, withLogs } from './utils'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  server: true,
  browser: true
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

describe('pages', () => {
  it('render index', async () => {
    const html = await $fetch('/')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    // should render text
    expect(html).toContain('Hello Nuxt 3!')
    // should inject runtime config
    expect(html).toContain('RuntimeConfig | testConfig: 123')
    // composables auto import
    expect(html).toContain('Composable | foo: auto imported from ~/components/foo.ts')
    expect(html).toContain('Composable | bar: auto imported from ~/components/useBar.ts')
    expect(html).toContain('Composable | template: auto imported from ~/components/template.ts')
    // should import components
    expect(html).toContain('This is a custom component with a named export.')
    // should apply attributes to client-only components
    expect(html).toContain('<div style="color:red;" class="client-only"></div>')
    // should register global components automatically
    expect(html).toContain('global component registered automatically')
    expect(html).toContain('global component via suffix')

    await expectNoClientErrors('/')
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
  })

  it('render 404', async () => {
    const html = await $fetch('/not-found')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('[...slug].vue')
    expect(html).toContain('404 at not-found')

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
  })

  it('/client-only-explicit-import', async () => {
    const html = await $fetch('/client-only-explicit-import')

    // ensure fallbacks with classes and arbitrary attributes are rendered
    expect(html).toContain('<div class="client-only-script" foo="bar">')
    expect(html).toContain('<div class="lazy-client-only-script-setup" foo="hello">')
    // ensure components are not rendered server-side
    expect(html).not.toContain('client only script')
    await expectNoClientErrors('/client-only-components')
  })
})

describe('head tags', () => {
  it('should render tags', async () => {
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
    expect(headHtml).toContain('script>console.log("works with useMeta too")</script>')
    expect(headHtml).toContain('<script src="https://a-body-appended-script.com" data-meta-body="true"></script></body>')

    const indexHtml = await $fetch('/')
    // should render charset by default
    expect(indexHtml).toContain('<meta charset="utf-8">')
    // should render <Head> components
    expect(indexHtml).toContain('<title>Basic fixture</title>')
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
    const { headers } = await fetch('/navigate-to/', { redirect: 'manual' })

    expect(headers.get('location')).toEqual('/')
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
})

describe('reactivity transform', () => {
  it('should works', async () => {
    const html = await $fetch('/')

    expect(html).toContain('Sugar Counter 12 x 2 = 24')
  })
})

describe('server tree shaking', () => {
  it('should work', async () => {
    const html = await $fetch('/client')

    expect(html).toContain('This page should not crash when rendered')
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
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)))

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
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)))

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
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)))

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
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)))

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

describe.skipIf(process.env.NUXT_TEST_DEV || process.env.TEST_WITH_WEBPACK)('inlining component styles', () => {
  it('should inline styles', async () => {
    const html = await $fetch('/styles')
    for (const style of [
      '{--assets:"assets"}', // <script>
      '{--scoped:"scoped"}', // <style lang=css>
      '{--postcss:"postcss"}', // <style lang=postcss>
      '{--global:"global"}', // entryfile dependency
      '{--plugin:"plugin"}', // plugin dependency
      '{--functional:"functional"}' // functional component with css import
    ]) {
      expect(html).toContain(style)
    }
  })

  it('only renders prefetch for entry styles', async () => {
    const html: string = await $fetch('/styles')
    expect(html.match(/<link [^>]*href="[^"]*\.css">/)?.map(m => m.replace(/\.[^.]*\.css/, '.css'))).toMatchInlineSnapshot(`
        [
          "<link rel=\\"prefetch stylesheet\\" href=\\"/_nuxt/entry.css\\">",
        ]
      `)
  })

  it('still downloads client-only styles', async () => {
    const page = await createPage('/styles')
    await page.waitForLoadState('networkidle')
    expect(await page.$eval('.client-only-css', e => getComputedStyle(e).color)).toBe('rgb(50, 50, 50)')
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

describe.runIf(process.env.NUXT_TEST_DEV)('detecting invalid root nodes', () => {
  it('should detect invalid root nodes in pages', async () => {
    for (const path of ['1', '2', '3', '4']) {
      const { consoleLogs } = await renderPage(joinURL('/invalid-root', path))
      const consoleLogsWarns = consoleLogs.filter(i => i.type === 'warning').map(w => w.text).join('\n')
      expect(consoleLogsWarns).toContain('does not have a single root node and will cause errors when navigating between routes')
    }
  })

  it('should not complain if there is no transition', async () => {
    for (const path of ['fine']) {
      const { consoleLogs } = await renderPage(joinURL('/invalid-root', path))

      const consoleLogsWarns = consoleLogs.filter(i => i.type === 'warning')

      expect(consoleLogsWarns.length).toEqual(0)
    }
  })
})

// TODO: dynamic paths in dev
describe.skipIf(process.env.NUXT_TEST_DEV)('dynamic paths', () => {
  it('should work with no overrides', async () => {
    const html: string = await $fetch('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"|url\(([^)]*?)\)/g)) {
      const url = match[2] || match[3]
      expect(url.startsWith('/_nuxt/') || url === '/public.svg').toBeTruthy()
    }
  })

  // Webpack injects CSS differently
  it.skipIf(process.env.TEST_WITH_WEBPACK)('adds relative paths to CSS', async () => {
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
        (process.env.TEST_WITH_WEBPACK && url === '/public.svg')
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
        (process.env.TEST_WITH_WEBPACK && url === '/public.svg')
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
        (process.env.TEST_WITH_WEBPACK && url === '/public.svg')
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
  })
})

describe.skipIf(process.env.NUXT_TEST_DEV || isWindows)('payload rendering', () => {
  it('renders a payload', async () => {
    const payload = await $fetch('/random/a/_payload.js', { responseType: 'text' })
    expect(payload).toMatch(
      /export default \{data:\{\$frand_a:\[[^\]]*\]\},prerenderedAt:\d*\}/
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

    const importSuffix = process.env.NUXT_TEST_DEV && !process.env.TEST_WITH_WEBPACK ? '?import' : ''

    // We are manually prefetching other payloads
    expect(requests).toContain('/random/c/_payload.js')

    // We are not triggering API requests in the payload
    expect(requests).not.toContain(expect.stringContaining('/api/random'))
    // requests.length = 0

    await page.click('[href="/random/b"]')
    await page.waitForLoadState('networkidle')

    // We are not triggering API requests in the payload in client-side nav
    expect(requests).not.toContain('/api/random')

    // We are fetching a payload we did not prefetch
    expect(requests).toContain('/random/b/_payload.js' + importSuffix)

    // We are not refetching payloads we've already prefetched
    // expect(requests.filter(p => p.includes('_payload')).length).toBe(1)
    // requests.length = 0

    await page.click('[href="/random/c"]')
    await page.waitForLoadState('networkidle')

    // We are not triggering API requests in the payload in client-side nav
    expect(requests).not.toContain('/api/random')

    // We are not refetching payloads we've already prefetched
    // Note: we refetch on dev as urls differ between '' and '?import'
    // expect(requests.filter(p => p.includes('_payload')).length).toBe(process.env.NUXT_TEST_DEV ? 1 : 0)
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
