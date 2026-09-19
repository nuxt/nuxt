import { describe, expect, it } from 'vitest'
import type { Manifest as ViteClientManifest } from 'vite'
import { aliasFacadelessChunkModules } from '../src/plugins/client-manifest.ts'

// https://github.com/nuxt/nuxt/issues/36343
describe('aliasFacadelessChunkModules', () => {
  it('aliases source modules of a facade-less chunk to the chunk entry', () => {
    const clientManifest: ViteClientManifest = {
      // facade-less chunk, keyed by file name (as emitted by vite:manifest)
      '_abc123.js': {
        file: '_nuxt/_abc123.js',
        css: ['_nuxt/_abc123.css'],
        imports: ['_nuxt/_shared.js'],
      },
      // regular facade entry, untouched
      'components/other.vue': {
        file: '_nuxt/_other.js',
        src: 'components/other.vue',
        css: ['_nuxt/_other.css'],
      },
    }

    aliasFacadelessChunkModules(clientManifest, [
      { file: '_nuxt/_abc123.js', modules: ['layouts/default.vue', 'components/other.vue'] },
    ])

    // the layout had no manifest entry: it now resolves to the chunk's CSS
    expect(clientManifest['layouts/default.vue']).toMatchObject({
      file: '_nuxt/_abc123.js',
      css: ['_nuxt/_abc123.css'],
      imports: ['_nuxt/_shared.js'],
    })
    // existing entries are never overwritten
    expect(clientManifest['components/other.vue']).toMatchObject({
      file: '_nuxt/_other.js',
      src: 'components/other.vue',
    })
  })

  it('skips chunks without CSS and unknown chunk files', () => {
    const clientManifest: ViteClientManifest = {
      '_noCss.js': { file: '_nuxt/_noCss.js' },
    }

    aliasFacadelessChunkModules(clientManifest, [
      { file: '_nuxt/_noCss.js', modules: ['components/plain.ts'] },
      { file: '_nuxt/_missing.js', modules: ['components/ghost.vue'] },
    ])

    expect(clientManifest['components/plain.ts']).toBeUndefined()
    expect(clientManifest['components/ghost.vue']).toBeUndefined()
  })

  it('copies assets and dynamic imports of the chunk entry', () => {
    const clientManifest: ViteClientManifest = {
      '_abc123.js': {
        file: '_nuxt/_abc123.js',
        css: ['_nuxt/_abc123.css'],
        assets: ['_nuxt/_font.woff2'],
        dynamicImports: ['_nuxt/_lazy.js'],
      },
    }

    aliasFacadelessChunkModules(clientManifest, [
      { file: '_nuxt/_abc123.js', modules: ['components/card.vue'] },
    ])

    expect(clientManifest['components/card.vue']).toMatchObject({
      css: ['_nuxt/_abc123.css'],
      assets: ['_nuxt/_font.woff2'],
      dynamicImports: ['_nuxt/_lazy.js'],
    })
    // aliased arrays are copies, not shared references
    expect(clientManifest['components/card.vue']!.css).not.toBe(clientManifest['_abc123.js']!.css)
  })

  it('does nothing when there are no facade-less chunks', () => {
    const clientManifest: ViteClientManifest = {
      'components/other.vue': { file: '_nuxt/_other.js', src: 'components/other.vue' },
    }
    aliasFacadelessChunkModules(clientManifest, [])
    expect(Object.keys(clientManifest)).toEqual(['components/other.vue'])
  })
})
