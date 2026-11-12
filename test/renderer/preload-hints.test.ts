import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUILD_ASSETS_DIR, createEvent, render } from './harness'

const config = vi.hoisted(() => {
  const modules = {
    layouts: { panel: 'components/DeferredPanel.vue', missing: 'layouts/missing.vue' },
    // keyed as the route component loaders are marked; the entry module of the fixture stands in
    // for a module whose chunks all load with the entry
    pages: {
      panelKey: 'components/DeferredPanel.vue',
      entryKey: '../../../../packages/nuxt/src/app/entry.ts',
      missingKey: 'pages/missing.vue',
    } as Record<string, string>,
    moduleScripts: true,
    crossOrigin: true,
  }
  return {
    modules: modules as typeof modules | undefined,
    initial: modules,
    // stands in for a `build:manifest` hook, which runs before the dependencies are precomputed
    patchPrecomputed: undefined as ((precomputed: any) => void) | undefined,
  }
})

vi.mock('nuxt/internal/precomputed', async (importOriginal) => {
  const { default: precomputed } = await importOriginal<{ default: unknown }>()
  return {
    default: () => {
      const copy = structuredClone(precomputed)
      config.patchPrecomputed?.(copy)
      return copy
    },
  }
})

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  NUXT_SSR_STREAMING: true,
  get NUXT_PRELOAD_MODULES () { return config.modules },
}))

afterEach(() => {
  config.modules = config.initial
  config.patchPrecomputed = undefined
})

// the harness renders with the build id `standalone`
const PAGE_HINTS_PATH = '/__nuxt_preload/standalone.json'

function renderPage (rules: Record<string, unknown>) {
  return render('/', { getRouteRules: () => ({ ssr: true, ...rules }) }, createEvent('/', { headers: { 'user-agent': 'Mozilla/5.0' } }))
}

interface PreloadHint { rel: string, as?: string, file: string, noCors?: true }

function documentHints (html: string): { files: PreloadHint[], layouts: Record<string, number[]>, pages?: string } | undefined {
  const json = html.match(/<script type="application\/json" data-nuxt-preload="[^"]+">([^<]*)<\/script>/)?.[1]
  return json ? JSON.parse(json) : undefined
}

const panelChunks = [
  { rel: 'modulepreload', file: expect.stringMatching(/^[^"/]+\.js$/) },
  { rel: 'preload', as: 'style', file: expect.stringMatching(/^DeferredPanel[^"/]*\.css$/) },
]

describe.each([
  ['buffered render', { ssr: true, streaming: false }],
  ['streamed render', { ssr: true, streaming: true }],
  ['spa shell', { ssr: false, streaming: false }],
])('preload hints of a %s', (_, rules) => {
  it('list the chunks each layout needs beyond the entry, and where those of route components are', async () => {
    const { html } = await renderPage(rules)
    const hints = documentHints(html)!

    expect(hints.layouts.panel!.map(index => hints.files[index])).toEqual(expect.arrayContaining(panelChunks))
    // modules missing from the manifest need no hints
    expect(hints.layouts).not.toHaveProperty('missing')
    expect(hints.pages).toBe(PAGE_HINTS_PATH)
  })
})

describe('route component hints', () => {
  it('are served for the current build, and cached for its lifetime', async () => {
    const { response, html } = await render(PAGE_HINTS_PATH)
    const hints = JSON.parse(html) as { files: PreloadHint[], chunks: Record<string, number[]> }

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(hints.chunks.panelKey!.map(index => hints.files[index])).toEqual(expect.arrayContaining(panelChunks))
    // a module loaded with the entry has nothing left to fetch, while one missing from the
    // manifest has no hints at all
    expect(hints.chunks).toEqual({ panelKey: expect.any(Array), entryKey: [] })
    // only the opaque keys reach the client, never the source paths behind them
    expect(html).not.toContain('DeferredPanel.vue')
    expect(new Set(hints.files.map(file => file.file)).size).toBe(hints.files.length)
    // cached for the lifetime of the build, so nothing in them may depend on the runtime config
    expect(html).not.toContain(BUILD_ASSETS_DIR)
  })

  it('are not served for another build', async () => {
    const { response } = await render('/__nuxt_preload/previous.json')
    expect(response.status).toBe(404)
  })

  it('request stylesheets without CORS where the client build does', async () => {
    config.modules = { ...config.initial, crossOrigin: false }
    const hints = JSON.parse((await render(PAGE_HINTS_PATH)).html) as { files: PreloadHint[] }

    expect(hints.files).toContainEqual(expect.objectContaining({ as: 'style', noCors: true }))
    expect(hints.files.filter(file => file.rel === 'modulepreload').every(file => !('noCors' in file))).toBe(true)
  })

  // the manifest marks every `.js` file as a module, whichever way the client build loads it
  it('hint chunks as classic scripts where the client build loads them as such', async () => {
    config.modules = { ...config.initial, moduleScripts: false, crossOrigin: false }
    const hints = JSON.parse((await render(PAGE_HINTS_PATH)).html) as { files: PreloadHint[], chunks: Record<string, number[]> }

    expect(hints.chunks.panelKey!.map(index => hints.files[index])).toEqual(expect.arrayContaining([
      { rel: 'preload', as: 'script', file: expect.stringMatching(/\.js$/), noCors: true },
      { rel: 'preload', as: 'style', file: expect.stringMatching(/\.css$/), noCors: true },
    ]))
    expect(hints.files.map(file => file.rel)).not.toContain('modulepreload')
  })

  // listed with only its stylesheet, a prefetch would fetch a part of it
  it('leave out a module whose script the manifest does not preload', async () => {
    config.patchPrecomputed = (precomputed) => {
      delete precomputed.dependencies['components/DeferredPanel.vue'].preload['components/DeferredPanel.vue']
    }
    const hints = JSON.parse((await render(PAGE_HINTS_PATH)).html) as { chunks: Record<string, number[]> }

    expect(hints.chunks).toEqual({ entryKey: [] })
    expect(documentHints((await renderPage({})).html)!.layouts).not.toHaveProperty('panel')
  })
})

describe('preload hints', () => {
  it('are not rendered on a noScripts route', async () => {
    const { html } = await renderPage({ noScripts: true })
    expect(html).not.toContain('data-nuxt-preload')
  })

  // their presence is how the client tells a build with hints, where a prefetch evaluates
  // nothing, from one without, where it loads what it fetches
  it('are rendered even when no layout has chunks to list', async () => {
    config.modules = { ...config.initial, layouts: { missing: 'layouts/missing.vue' } as typeof config.initial.layouts }
    const { html } = await renderPage({})
    expect(documentHints(html)).toMatchObject({ files: [], layouts: {} })
  })

  it('are not rendered without `experimental.routeChunkHints`', async () => {
    config.modules = undefined
    const { html } = await renderPage({})
    expect(html).not.toContain('data-nuxt-preload')
  })
})
