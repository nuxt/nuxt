import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup, startServer } from '@nuxt/test-utils/e2e'

import { isWebpack, runsOncePerBuilderInMatrix } from './matrix'

if (runsOncePerBuilderInMatrix) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/dynamic-paths', import.meta.url)),
    dev: false,
    server: true,
    browser: false,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

// TODO: dynamic paths in dev
describe.skipIf(!runsOncePerBuilderInMatrix)('dynamic paths', () => {
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
    for (const match of html.matchAll(/(?:href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[1] || match[2]!
      if (url.startsWith('data:')) { continue }
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
    for (const match of html.matchAll(/(?:href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[1] || match[2]!
      if (url.startsWith('data:')) { continue }
      expect(url.startsWith('/foo/_other/') || isPublicFile('/foo/', url)).toBeTruthy()
    }

    // TODO: document as breaking change
    expect(await $fetch<string>('/foo/url')).toContain('path: /url')
  })

  it('should allow setting relative baseURL', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: './',
      },
    })

    const html = await $fetch<string>('/assets')
    for (const match of html.matchAll(/(?:href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[1] || match[2]!
      if (url.startsWith('data:')) { continue }
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
    for (const match of html.matchAll(/(?:href|src)="(.*?)"|url\(([^)]*)\)/g)) {
      const url = match[1] || match[2]!
      if (url.startsWith('data:')) { continue }
      expect(url.startsWith('https://example.com/_cdn/') || isPublicFile('https://example.com/', url)).toBeTruthy()
    }
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
