import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import { renderIndexHtml } from './html.ts'

function createNuxt (overrides: Record<string, unknown> = {}) {
  return {
    options: {
      ssr: false,
      app: {
        baseURL: '/',
        buildAssetsDir: '/_nuxt/',
        rootTag: 'div',
        rootAttrs: { id: '__nuxt' },
        teleportTag: 'div',
        teleportAttrs: { id: 'teleports' },
        spaLoaderTag: 'div',
        spaLoaderAttrs: { id: '__nuxt-loader' },
        head: {
          title: 'Test app',
          meta: [{ charset: 'utf-8' }],
          link: [],
          style: [],
          script: [],
          noscript: [],
          htmlAttrs: { lang: 'en' },
        },
      },
      runtimeConfig: {
        app: { baseURL: '/', buildAssetsDir: '/_nuxt/' },
        public: { greeting: 'hello' },
      },
      ...overrides,
    },
  } as unknown as Nuxt
}

describe('renderIndexHtml', () => {
  it('renders the app root, teleport target and configured head', () => {
    const html = renderIndexHtml(createNuxt(), './entry.js')

    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<title>Test app</title>')
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('<div id="__nuxt"></div>')
    expect(html).toContain('<div id="teleports"></div>')
    expect(html).toContain('<script type="module" src="./entry.js"></script>')
  })

  it('inlines public runtime config and marks the document as client-rendered', () => {
    const html = renderIndexHtml(createNuxt(), './entry.js')

    expect(html).toContain('"serverRendered":false')
    expect(html).toContain('"greeting":"hello"')
  })

  it('leaves stylesheets and preloads to vite', () => {
    const html = renderIndexHtml(createNuxt(), './entry.js')

    expect(html).not.toContain('rel="stylesheet"')
    expect(html).not.toContain('rel="modulepreload"')
  })

  it('renders an ssr outlet when rendering on the server is enabled', () => {
    expect(renderIndexHtml(createNuxt({ ssr: true }), './entry.js')).toContain('<div id="__nuxt"><!--ssr-outlet--></div>')
    expect(renderIndexHtml(createNuxt({ ssr: false }), './entry.js')).toContain('<div id="__nuxt"></div>')
  })

  it('wraps a provided loading template', () => {
    const html = renderIndexHtml(createNuxt(), './entry.js', '<p>loading</p>')

    expect(html).toContain('<div id="__nuxt-loader"><p>loading</p></div>')
  })
})
