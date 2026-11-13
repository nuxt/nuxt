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
const HINTS_PATH = '/__nuxt_preload/standalone.json'

function renderPage (rules: Record<string, unknown>) {
  return render('/', { getRouteRules: () => ({ ssr: true, ...rules }) }, createEvent('/', { headers: { 'user-agent': 'Mozilla/5.0' } }))
}

interface PreloadHint { rel: string, as?: string, file: string, noCors?: true }
interface Hints { files: PreloadHint[], layouts: Record<string, number[]>, pages: Record<string, number[]> }

function documentHints (html: string): { url?: string } | undefined {
  const json = html.match(/<script type="application\/json" data-nuxt-preload="[^"]+">([^<]*)<\/script>/)?.[1]
  return json ? JSON.parse(json) : undefined
}

async function renderHints () {
  const { response, html } = await render(HINTS_PATH)
  return { response, body: html, hints: JSON.parse(html) as Hints }
}

const panelChunks = [
  { rel: 'modulepreload', file: expect.stringMatching(/^[^"/]+\.js$/) },
  { rel: 'preload', as: 'style', file: expect.stringMatching(/^DeferredPanel[^"/]*\.css$/) },
]

describe.each([
  ['buffered render', { ssr: true, streaming: false }],
  ['streamed render', { ssr: true, streaming: true }],
  ['spa shell', { ssr: false, streaming: false }],
])('a %s', (_, rules) => {
  it('says where the hints of the build are, and lists none of them', async () => {
    const { html } = await renderPage(rules)
    expect(documentHints(html)).toEqual({ url: HINTS_PATH })
  })
})

describe('the renderer', () => {
  it('serves the hints of the current build, cached for its lifetime', async () => {
    const { response, body } = await renderHints()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(body).not.toContain('DeferredPanel.vue')
    expect(body).not.toContain(BUILD_ASSETS_DIR)
  })

  it('lists the chunks each layout and route component needs beyond the entry', async () => {
    const { hints } = await renderHints()

    expect(hints.layouts.panel!.map(index => hints.files[index])).toEqual(expect.arrayContaining(panelChunks))
    expect(hints.pages.panelKey!.map(index => hints.files[index])).toEqual(expect.arrayContaining(panelChunks))
    expect(hints.layouts).toEqual({ panel: expect.any(Array) })
    expect(hints.pages).toEqual({ panelKey: expect.any(Array), entryKey: [] })
  })

  it('lists a file a layout and a route component share once', async () => {
    const { hints } = await renderHints()

    expect(hints.layouts.panel).toEqual(hints.pages.panelKey)
    expect(new Set(hints.files.map(file => file.file)).size).toBe(hints.files.length)
  })

  it('does not serve the hints of another build', async () => {
    const { response } = await render('/__nuxt_preload/previous.json')
    expect(response.status).toBe(404)
  })

  it('hints stylesheets without CORS where the client build loads them that way', async () => {
    config.modules = { ...config.initial, crossOrigin: false }
    const { hints } = await renderHints()

    expect(hints.files).toContainEqual(expect.objectContaining({ as: 'style', noCors: true }))
    expect(hints.files.filter(file => file.rel === 'modulepreload').every(file => !('noCors' in file))).toBe(true)
  })

  it('hints chunks as classic scripts where the client build loads them as such', async () => {
    config.modules = { ...config.initial, moduleScripts: false, crossOrigin: false }
    const { hints } = await renderHints()

    expect(hints.pages.panelKey!.map(index => hints.files[index])).toEqual(expect.arrayContaining([
      { rel: 'preload', as: 'script', file: expect.stringMatching(/\.js$/), noCors: true },
      { rel: 'preload', as: 'style', file: expect.stringMatching(/\.css$/), noCors: true },
    ]))
    expect(hints.files.map(file => file.rel)).not.toContain('modulepreload')
  })

  it('leaves out a module whose script the manifest does not preload', async () => {
    config.patchPrecomputed = (precomputed) => {
      delete precomputed.dependencies['components/DeferredPanel.vue'].preload['components/DeferredPanel.vue']
    }
    const { hints } = await renderHints()

    expect(hints.layouts).toEqual({})
    expect(hints.pages).toEqual({ entryKey: [] })
  })

  it('does not render the pointer to the hints on a noScripts route', async () => {
    const { html } = await renderPage({ noScripts: true })
    expect(html).not.toContain('data-nuxt-preload')
  })

  it('renders the pointer without a URL when the build has nothing to hint', async () => {
    config.modules = { ...config.initial, layouts: {} as typeof config.initial.layouts, pages: {} }
    const { html } = await renderPage({})
    expect(documentHints(html)).toEqual({})
  })

  it('does not render the pointer without `experimental.routeChunkHints`', async () => {
    config.modules = undefined
    const { html } = await renderPage({})
    expect(html).not.toContain('data-nuxt-preload')
  })
})
