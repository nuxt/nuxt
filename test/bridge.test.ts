import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { setup, $fetch, startServer } from '@nuxt/test-utils'

describe('fixtures:bridge', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/bridge', import.meta.url)),
    server: true
  })

  describe('pages', () => {
    it('render hello world', async () => {
      expect(await $fetch('/')).to.contain('Hello Vue 2!')
    })
    it('uses server Vue build', async () => {
      expect(await $fetch('/')).to.contain('Rendered on server: true')
    })
  })

  describe('navigate', () => {
    it('should redirect to index with navigateTo', async () => {
      const html = await $fetch('/navigate-to/')
      expect(html).toContain('Hello Vue 2!')
    })
  })

  describe('dynamic paths', () => {
    if (process.env.TEST_WITH_WEBPACK) {
      // TODO:
      it.todo('work with webpack')
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
      const html = await $fetch('/assets')
      const urls = Array.from(html.matchAll(/(href|src)="(.*?)"/g)).map(m => m[2])
      const cssURL = urls.find(u => /_nuxt\/assets.*\.css$/.test(u))
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
        // TODO: should be /foo/public.svg
        expect(url.startsWith('/foo/_other/') || url === '/public.svg').toBeTruthy()
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
        // TODO: should be https://example.com/public.svg
        expect(url.startsWith('https://example.com/_cdn/') || url === '/public.svg').toBeTruthy()
      }
    })
  })
})
