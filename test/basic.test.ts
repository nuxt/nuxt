import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { setup, fetch, $fetch, startServer } from '@nuxt/test-utils'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  server: true
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
    // should render <Head> components
    expect(html).toContain('<title>Basic fixture</title>')
    // should inject runtime config
    expect(html).toContain('RuntimeConfig | testConfig: 123')
    // composables auto import
    expect(html).toContain('Composable | foo: auto imported from ~/components/foo.ts')
    expect(html).toContain('Composable | bar: auto imported from ~/components/useBar.ts')
    // plugins
    expect(html).toContain('Plugin | myPlugin: Injected by my-plugin')
    // should import components
    expect(html).toContain('This is a custom component with a named export.')
  })

  it('render 404', async () => {
    const html = await $fetch('/not-found')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('[...slug].vue')
    expect(html).toContain('404 at not-found')
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
  })

  it('/nested/[foo]/user-[group].vue', async () => {
    const html = await $fetch('/nested/foobar/user-admin')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('nested/[foo]/user-[group].vue')
    expect(html).toContain('foo: foobar')
    expect(html).toContain('group: admin')
  })

  it('/parent', async () => {
    const html = await $fetch('/parent')
    expect(html).toContain('parent/index')
  })

  it('/another-parent', async () => {
    const html = await $fetch('/another-parent')
    expect(html).toContain('another-parent/index')
  })
})

describe('navigate', () => {
  it('should redirect to index with navigateTo', async () => {
    const html = await $fetch('/navigate-to/')

    // Snapshot
    // expect(html).toMatchInlineSnapshot()

    expect(html).toContain('Hello Nuxt 3!')
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
})

describe('dynamic paths', () => {
  it('should work with no overrides', async () => {
    const html = await $fetch('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"/g)) {
      const url = match[2]
      expect(url.startsWith('/_nuxt/') || url === '/public.svg').toBeTruthy()
    }
  })

  it('adds relative paths to CSS', async () => {
    const html = await $fetch('/assets')
    const urls = Array.from(html.matchAll(/(href|src)="(.*?)"/g)).map(m => m[2])
    const cssURL = urls.find(u => /_nuxt\/entry.*\.css$/.test(u))
    if (process.env.TEST_WITH_WEBPACK) {
      // Webpack injects CSS differently
      return
    }
    const css = await $fetch(cssURL)
    const imageUrls = Array.from(css.matchAll(/url\(([^)]*)\)/g)).map(m => m[1].replace(/[-.][\w]{8}\./g, '.'))
    expect(imageUrls).toMatchInlineSnapshot(`
        [
          "./logo.svg",
          "../public.svg",
        ]
      `)
  })

  it('should allow setting base URL and build assets directory', async () => {
    process.env.NUXT_APP_BUILD_ASSETS_DIR = '/_other/'
    process.env.NUXT_APP_BASE_URL = '/foo/'
    await startServer()

    const html = await $fetch('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"/g)) {
      const url = match[2]
      // TODO: webpack does not yet support dynamic static paths
      expect(url.startsWith('/foo/_other/') || url === '/foo/public.svg' || (process.env.TEST_WITH_WEBPACK && url === '/public.svg')).toBeTruthy()
    }
  })

  it('should allow setting CDN URL', async () => {
    process.env.NUXT_APP_BASE_URL = '/foo/'
    process.env.NUXT_APP_CDN_URL = 'https://example.com/'
    process.env.NUXT_APP_BUILD_ASSETS_DIR = '/_cdn/'
    await startServer()

    const html = await $fetch('/assets')
    for (const match of html.matchAll(/(href|src)="(.*?)"/g)) {
      const url = match[2]
      // TODO: webpack does not yet support dynamic static paths
      expect(url.startsWith('https://example.com/_cdn/') || url === 'https://example.com/public.svg' || (process.env.TEST_WITH_WEBPACK && url === '/public.svg')).toBeTruthy()
    }
  })
})
