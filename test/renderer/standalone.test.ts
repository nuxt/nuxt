import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'
import type { NuxtRendererOptions } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'

type RendererEvent = Parameters<ReturnType<typeof createNuxtRenderer>['fetch']>[0]

const BUILD_ASSETS_DIR = '/_custom-assets/'

const runtimeConfig = {
  app: { baseURL: '/', buildAssetsDir: BUILD_ASSETS_DIR, cdnURL: '', buildId: 'standalone' },
  public: { greeting: 'hello from runtime config' },
} as unknown as ReturnType<NuxtRendererOptions['runtimeConfig']>

const options: NuxtRendererOptions = {
  runtimeConfig: () => runtimeConfig,
  buildAssetsURL: (...path) => joinURL(BUILD_ASSETS_DIR, ...path),
  publicAssetsURL: (...path) => joinURL('/', ...path),
  getRouteRules: () => ({ ssr: true }),
  hooks: () => ({ callHook: () => {} }),
  createResponse: (body, init) => new Response(body, init),
  createError: init => Object.assign(new Error(init.statusText), init),
}

function createEvent (path: string): RendererEvent {
  const url = new URL(path, 'http://localhost')
  return {
    req: new Request(url),
    url,
    res: { headers: new Headers() },
    context: {},
  } as unknown as RendererEvent
}

// `createNuxtRenderer` installs its options for the whole bundle, so each render creates
// the renderer it is about to use
function render (path: string, overrides?: Partial<NuxtRendererOptions>) {
  const renderer = createNuxtRenderer({ ...options, ...overrides })
  return renderer.fetch(createEvent(path)).then(async response => ({ response, html: await response.text() }))
}

describe('renderer without a server builder', () => {
  it('renders a document from a web-standard request event', async () => {
    const { response, html } = await render('/')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8')
    expect(response.headers.get('x-powered-by')).toBe('Nuxt')

    expect(html).toContain('<title>Standalone renderer | nuxt</title>')
    expect(html).toContain('<div id="__nuxt"><div><h1>rendered without nitro</h1>')
    expect(html).toContain('<p id="greeting">hello from runtime config</p>')
    expect(html).toContain('data-ssr="true" id="__NUXT_DATA__"')
    expect(html).toContain('"serverRendered":')
  })

  it('resolves asset URLs through the helpers it was given', async () => {
    const { html } = await render('/')

    expect(html).toContain(`<script type="importmap">{"imports":{"#entry":"${BUILD_ASSETS_DIR}`)
    expect(html).toContain(`<script type="module" src="${BUILD_ASSETS_DIR}`)
    expect(html).not.toContain('src="/_nuxt/')
  })

  it('serves the client-only shell for a route the rules opt out of ssr', async () => {
    const { html } = await render('/', { getRouteRules: () => ({ ssr: false }) })

    expect(html).toContain('<div id="__nuxt"></div>')
    expect(html).not.toContain('rendered without nitro')
    expect(html).toContain('data-ssr="false" id="__NUXT_DATA__"')
  })

  it('calls the render hooks the runtime exposes', async () => {
    const calls: string[] = []
    const { html } = await render('/', {
      hooks: () => ({
        callHook: ((name: string, context: any) => {
          calls.push(name)
          if (name === 'render:html') {
            context.bodyAppend.push('<!-- appended by a module -->')
          }
        }) as never,
      }),
    })

    expect(calls).toContain('render:route')
    expect(calls).toContain('render:html')
    expect(html).toContain('<!-- appended by a module --></body>')
  })

  it('refuses an internal error route with the error the runtime constructs', async () => {
    const renderer = createNuxtRenderer(options)
    const rendered = Promise.resolve().then(() => renderer.fetch(createEvent('/__nuxt_error')))

    await expect(rendered).rejects.toMatchObject({ status: 404 })
  })
})
