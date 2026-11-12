import { describe, expect, it } from 'vitest'
import { $fetch, fetch, startServer } from '@nuxt/test-utils/e2e'

import { isWebpack, runsOncePerBuilderInMatrix } from './matrix'
import { setupFixture } from './utils'

await setupFixture('dynamic-paths', runsOncePerBuilderInMatrix)

// TODO: dynamic paths in dev
describe.skipIf(!runsOncePerBuilderInMatrix)('dynamic paths', () => {
  const publicFiles = ['/public.svg', '/css-only-public-asset.svg']
  const isPublicFile = (base = '/', file: string) => {
    if (isWebpack) {
      // TODO: webpack does not yet apply the base URL to public assets referenced from templates
      expect(publicFiles).toContain(file.startsWith(base) ? file.replace(base, '/') : file)
      return true
    }

    expect(file).toMatch(new RegExp(`^${base.replace(/\//g, '\\/')}`))
    expect(publicFiles).toContain(file.replace(base, '/'))
    return true
  }

  it('should keep url() wrappers in inlined styles', async () => {
    const html: string = await $fetch<string>('/inline-url')
    const inlinedStyles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), m => m[1]!).join('\n')

    expect(inlinedStyles).toMatch(/\.inline-public-asset\s*\{\s*background-image:\s*url\(['"]?\/public\.svg['"]?\)/)
    expect(inlinedStyles).toMatch(/\.inline-build-asset\s*\{\s*background-image:\s*url\([^)]*logo[^)]*\.svg\)/)
    expect(inlinedStyles).toMatch(/src:\s*url\(['"]?\/css-only-public-asset\.svg['"]?\)\s*format\(/)
  })

  it('should only inline the styles of rendered components that opt in', async () => {
    async function getStyles (path: string) {
      const html = await $fetch<string>(path)
      const stylesheets = Array.from(html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g), m => $fetch<string>(m[1]!))
      return {
        inlined: Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), m => m[1]!).join('\n'),
        linked: (await Promise.all(stylesheets)).join('\n'),
      }
    }

    expect((await getStyles('/inline-url')).inlined).not.toMatch(/#__nuxt\s*\{/)
    for (const [path, rule] of [['/assets', /#__nuxt\s*\{/], ['/script-assets', /\.script-assets\s*\{/]] as const) {
      const { inlined, linked } = await getStyles(path)
      expect(inlined, path).not.toMatch(rule)
      expect(linked, path).toMatch(rule)
    }
  })

  // https://github.com/nuxt/nuxt/issues/14766
  it.skipIf(isWebpack)('resolves dynamic and glob asset imports during SSR', async () => {
    const testIds = ['dynamic-import-asset', 'lazy-glob-asset', 'eager-glob-asset'] as const
    const html = await $fetch<string>('/dynamic-assets?asset=two')

    for (const testId of testIds) {
      const image = html.match(new RegExp(`<img[^>]*data-testid="${testId}"[^>]*>`))?.[0]
      const src = image?.match(/src="([^"]+)"/)?.[1]

      expect(src).toMatch(/^\/_nuxt\/.+\.svg$/)
      const asset = await fetch(src!)
      expect(await asset.text()).toContain('dynamic-two')
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

  it.each([
    ['no overrides', {}, '/assets', '/', '/_nuxt/'],
    ['a base URL and build assets directory', { NUXT_APP_BUILD_ASSETS_DIR: '/_other/', NUXT_APP_BASE_URL: '/foo/' }, '/foo/assets', '/foo/', '/foo/_other/'],
    ['a relative base URL', { NUXT_APP_BASE_URL: './' }, '/assets', './', './_nuxt/'],
    ['a CDN URL', { NUXT_APP_BASE_URL: '/foo/', NUXT_APP_CDN_URL: 'https://example.com/', NUXT_APP_BUILD_ASSETS_DIR: '/_cdn/' }, '/foo/assets', 'https://example.com/', 'https://example.com/_cdn/'],
  ])('should prefix asset URLs when started with %s', async (_, env, path, base, assetsDir) => {
    await startServer({ env })

    const html = await $fetch<string>(path)
    for (const match of html.matchAll(/(?:href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[1] || match[2]!
      if (url.startsWith('data:')) { continue }
      expect(url.startsWith(assetsDir) || isPublicFile(base, url)).toBeTruthy()
      expect(url).not.toContain('_nuxt/_nuxt')
    }
  })

  // remove `.fails` when webpack applies the base URL to public assets referenced from templates
  it.skipIf(!isWebpack).fails('should apply base URL to public assets referenced from templates', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: '/foo/',
      },
    })

    const html = await $fetch<string>('/foo/assets')
    const sources = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g), m => m[1]!)
    expect(sources).toContain('/foo/public.svg')
  })

  // https://github.com/nuxt/nuxt/issues/36133
  it.skipIf(isWebpack)('should apply base URL to public assets referenced from inlined SFC styles', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: '/foo/',
      },
    })

    const html = await $fetch<string>('/foo/inline-styles')
    const inlineStyles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), m => m[1]!).join('\n')
    expect(inlineStyles).toContain('url(/foo/public.svg)')
    expect(inlineStyles).not.toContain('url(/public.svg)')
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
    // TODO: document as breaking change
    expect(await $fetch<string>('/foo/url')).toContain('path: /url')
  })

  it.skipIf(isWebpack)('should render relative importmap path with relative path', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: '',
        NUXT_APP_BUILD_ASSETS_DIR: 'assets/',
      },
    })

    const html = await $fetch<string>('/')
    expect(html).toContain('<script type="importmap">{"imports":{"#entry":"./assets')
  })
})
