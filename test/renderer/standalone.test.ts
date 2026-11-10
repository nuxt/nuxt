import { describe, expect, it, vi } from 'vitest'
import { parse } from 'devalue'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'
import { renderPayloadJsonScript } from '../../packages/nuxt/src/runtime/server/renderer/payload.ts'
import type { NuxtSSRContext } from '../../packages/nuxt/src/app/types.ts'

import { BUILD_ASSETS_DIR, createEvent, options, render } from './harness'

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  NUXT_SSR_STREAMING: true,
}))

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

  it('sends the document as chunks when the runtime can encode them', async () => {
    const { html: joined } = await render('/')

    let chunks: string[] | undefined
    const { html } = await render('/', {
      createDocumentResponse: (received, init) => {
        chunks = received
        return new Response(received.join(''), init)
      },
    })

    expect(chunks!.length).toBeGreaterThan(2)
    expect(chunks!.some(chunk => chunk.includes('<h1>rendered without nitro</h1>'))).toBe(true)
    expect(html).toBe(joined)
  })

  it('falls back to a single string once a listener replaces the app markup', async () => {
    let chunks: string[] | undefined
    const { html } = await render('/', {
      hooks: () => ({
        callHook: ((name: string, context: { body: string[] }) => {
          if (name === 'render:html') {
            context.body[0] = context.body[0]!.replace('rendered without nitro', 'rendered and replaced')
          }
        }) as never,
      }),
      createDocumentResponse: (received, init) => {
        chunks = received
        return new Response(received.join(''), init)
      },
    })

    expect(chunks).toBeUndefined()
    expect(html).toContain('<h1>rendered and replaced</h1>')
  })

  it('sends the app markup an `app:rendered` listener rewrote', async () => {
    const { html } = await render('/rewritten', {
      createDocumentResponse: (received, init) => new Response(received.join(''), init),
    })

    expect(html).toContain('<h1>rewritten after render</h1>')
  })

  it.each([false, true])('leaves `prefetchLinks` out of an inlined payload (streaming: %s)', async (streaming) => {
    const event = createEvent('/prefetch-links', { headers: { 'user-agent': 'Mozilla/5.0' } })
    const { html } = await render('/prefetch-links', { getRouteRules: () => ({ ssr: true, streaming }) }, event)

    expect(html.includes('window.__unhead__')).toBe(streaming)
    expect(html).toContain('rendered without nitro')
    expect(html).not.toContain('next-page.js')
  })

  it('resolves asset URLs through the helpers it was given', async () => {
    const { html } = await render('/')

    expect(html).toContain(`<script type="importmap">{"imports":{"#entry":"${BUILD_ASSETS_DIR}`)
    expect(html).toContain(`<script type="module" src="${BUILD_ASSETS_DIR}`)
    expect(html).not.toContain('src="/_nuxt/')
  })

  it.each([
    ['data', {}, { key: 'value' }],
    ['state', {}, { key: 'value' }],
    ['once', new Set<string>(), new Set(['key'])],
    ['_errors', {}, { key: 'value' }],
  ] as const)('omits only empty %s payload containers, without mutating the payload', (key, empty, populated) => {
    for (const value of [empty, populated]) {
      const original = value instanceof Set ? new Set(value) : { ...value }
      const payload = { [key]: value, serverRendered: true }
      const ssrContext = { config: {}, payload } as unknown as NuxtSSRContext
      const [script] = renderPayloadJsonScript({ ssrContext, data: payload })

      expect(parse(script!.innerHTML as string)).toEqual(value === empty ? { serverRendered: true } : { [key]: original, serverRendered: true })
      expect(payload[key]).toBe(value)
      expect(payload[key]).toEqual(original)
    }
  })

  it('omits all empty payload containers at once', () => {
    const payload = { data: {}, state: {}, once: new Set(), _errors: {}, serverRendered: true }
    const ssrContext = { config: {}, payload } as unknown as NuxtSSRContext
    const [script] = renderPayloadJsonScript({ ssrContext, data: payload })

    expect(parse(script!.innerHTML as string)).toEqual({ serverRendered: true })
    expect(payload).toEqual({ data: {}, state: {}, once: new Set(), _errors: {}, serverRendered: true })
  })

  it.each([
    ['buffered render', { ssr: true, streaming: false }],
    ['streamed render', { ssr: true, streaming: true }],
    ['spa shell', { ssr: false, streaming: false }],
  ])('does not modulepreload the entry script of a %s', async (_, rules) => {
    const event = createEvent('/', { headers: { 'user-agent': 'Mozilla/5.0' } })
    const { html } = await render('/', { getRouteRules: () => rules }, event)

    expect(html.includes('window.__unhead__')).toBe(rules.streaming === true)
    expect(html).toContain(`rel="preload" as="font" type="font/woff2" crossorigin href="${BUILD_ASSETS_DIR}fonts/standalone.woff2"`)

    const entry = html.match(/<script type="module" src="([^"]+)"/)?.[1]
    expect(entry).toBeTruthy()
    expect(html).not.toMatch(new RegExp(`<link rel="modulepreload"[^>]*href="${entry}"`))
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

  it('keeps the options of each renderer to itself', async () => {
    const ssr = createNuxtRenderer(options)
    const spa = createNuxtRenderer({ ...options, getRouteRules: () => ({ ssr: false }) })

    const [spaHtml, ssrHtml] = await Promise.all([
      spa.fetch(createEvent('/')).then(r => r.text()),
      ssr.fetch(createEvent('/')).then(r => r.text()),
    ])

    expect(ssrHtml).toContain('rendered without nitro')
    expect(spaHtml).not.toContain('rendered without nitro')
  })

  it('refuses an internal error route with the error the runtime constructs', async () => {
    const renderer = createNuxtRenderer(options)

    await expect(renderer.fetch(createEvent('/__nuxt_error'))).rejects.toMatchObject({ status: 404 })
  })
})

describe('noScripts route rules', () => {
  it('renders non-script resource hints without any scripts', async () => {
    const { html } = await render('/', { getRouteRules: () => ({ ssr: true, noScripts: true }) })

    expect(html).toContain('rendered without nitro')
    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('__NUXT_DATA__')
    expect(html).not.toContain('modulepreload')
    expect(html).not.toContain('as="script"')
    expect(html).toContain(`rel="preload" as="font" type="font/woff2" crossorigin href="${BUILD_ASSETS_DIR}fonts/standalone.woff2"`)
  })

  it('advertises the same hints over early hints as it renders in the document', async () => {
    const hints: string[] = []
    await render('/', {
      getRouteRules: () => ({ ssr: true, noScripts: true }),
      writeEarlyHints: (_event, hint) => { hints.push(hint.link) },
    })

    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain(`<${BUILD_ASSETS_DIR}fonts/standalone.woff2>; rel="preload"; as="font"; type="font/woff2"; crossorigin`)
    expect(hints[0]).not.toContain('modulepreload')
    expect(hints[0]).not.toContain('as="script"')
  })

  it('keeps script hints in the early hints of a scripted route', async () => {
    const hints: string[] = []
    await render('/', {
      writeEarlyHints: (_event, hint) => { hints.push(hint.link) },
    })

    expect(hints[0]).toContain('rel="modulepreload"')
    expect(hints[0]).toContain(`<${BUILD_ASSETS_DIR}fonts/standalone.woff2>; rel="preload"; as="font"`)
  })

  it('does not let a noScripts request poison the hints of a scripted one', async () => {
    const hints: string[] = []
    const renderer = createNuxtRenderer({
      ...options,
      getRouteRules: event => ({ ssr: true, noScripts: event.url.search === '?no-scripts' }),
      writeEarlyHints: (_event, hint) => { hints.push(hint.link) },
    })

    await renderer.fetch(createEvent('/?no-scripts'))
    await renderer.fetch(createEvent('/'))
    await renderer.fetch(createEvent('/?no-scripts'))

    expect(hints[0]).not.toContain('modulepreload')
    expect(hints[1]).toContain('modulepreload')
    expect(hints[2]).not.toContain('modulepreload')
    for (const hint of hints) {
      expect(hint).toContain('fonts/standalone.woff2')
    }
  })
})
