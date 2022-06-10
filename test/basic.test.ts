import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// import { isWindows } from 'std-env'
import { setup, fetch, $fetch, startServer } from '@nuxt/test-utils'
import { expectNoClientErrors } from './utils'

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

    await expectNoClientErrors('/')
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
})

describe('head tags', () => {
  it('should render tags', async () => {
    const html = await $fetch('/head')
    expect(html).toContain('<title>Using a dynamic component - Fixture</title>')
    expect(html).not.toContain('<meta name="description" content="first">')
    expect(html).toContain('<meta charset="utf-16">')
    expect(html).not.toContain('<meta charset="utf-8">')
    expect(html).toContain('<meta name="description" content="overriding with an inline useHead call">')
    expect(html).toMatch(/<html[^>]*class="html-attrs-test"/)
    expect(html).toMatch(/<body[^>]*class="body-attrs-test"/)
    expect(html).toContain('script>console.log("works with useMeta too")</script>')

    const index = await $fetch('/')
    // should render charset by default
    expect(index).toContain('<meta charset="utf-8">')
    // should render <Head> components
    expect(index).toContain('<title>Basic fixture - Fixture</title>')
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
    expect(res.status).toBe(500)
    const error = await res.json()
    delete error.stack
    expect(error).toMatchObject({
      description: process.env.NUXT_TEST_DEV ? expect.stringContaining('<pre>') : '',
      message: 'This is a custom error',
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      url: '/error'
    })
  })

  it('should render a HTML error page', async () => {
    const res = await fetch('/error')
    expect(await res.text()).toContain('This is a custom error')
  })
})

describe('middlewares', () => {
  it('should redirect to index with global middleware', async () => {
    const html = await $fetch('/redirect/')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('Hello Nuxt 3!')
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
})

describe('reactivity transform', () => {
  it('should works', async () => {
    const html = await $fetch('/')

    expect(html).toContain('Sugar Counter 12 x 2 = 24')
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
      const routerLinkClasses = html.match(/href="\/" class="([^"]*)"/)[1].split(' ')
      expect(routerLinkClasses).toContain('foo-active-class')
      expect(routerLinkClasses).toContain('bar-exact-active-class')
    })
  })
})

describe('dynamic paths', () => {
  if (process.env.NUXT_TEST_DEV) {
    // TODO:
    it.todo('dynamic paths in dev')
    return
  }

  it('should work with no overrides', async () => {
    const html = await $fetch('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"/g)) {
      const url = match[2]
      expect(url.startsWith('/_nuxt/') || url === '/public.svg').toBeTruthy()
    }
  })

  it('adds relative paths to CSS', async () => {
    if (process.env.TEST_WITH_WEBPACK) {
      // Webpack injects CSS differently
      return
    }

    const html = await $fetch('/assets')
    const urls = Array.from(html.matchAll(/(href|src)="(.*?)"/g)).map(m => m[2])
    const cssURL = urls.find(u => /_nuxt\/entry.*\.css$/.test(u))
    expect(cssURL).toBeDefined()
    const css = await $fetch(cssURL)
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
    for (const match of html.matchAll(/(href|src)="(.*?)"/g)) {
      const url = match[2]
      // TODO: webpack does not yet support dynamic static paths
      expect(url.startsWith('/foo/_other/') || url === '/foo/public.svg' || (process.env.TEST_WITH_WEBPACK && url === '/public.svg')).toBeTruthy()
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
    for (const match of html.matchAll(/(href|src)="(.*?)"/g)) {
      const url = match[2]
      // TODO: webpack does not yet support dynamic static paths
      expect(url.startsWith('https://example.com/_cdn/') || url === 'https://example.com/public.svg' || (process.env.TEST_WITH_WEBPACK && url === '/public.svg')).toBeTruthy()
    }
  })
})
