import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEvent, render } from './harness'

const config = vi.hoisted(() => ({ streaming: false }))
const initialEntries = vi.hoisted(() => [] as Array<Array<{ input: any, _precomputedTags?: unknown[] }>>)

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  get NUXT_SSR_STREAMING () { return config.streaming },
  appHead: {
    htmlAttrs: { lang: 'en', class: 'app' },
    titleTemplate: '%s %separator %siteName',
    templateParams: { separator: '·', siteName: 'App site' },
    meta: [
      { charset: 'utf-8' },
      { name: 'description', content: 'app description' },
      { key: 'theme', name: 'theme-color', content: '#fff' },
      { property: 'og:image', content: '/a.png' },
      { property: 'og:image', content: '/b.png' },
    ],
    link: [{ rel: 'icon', href: '/favicon.ico' }],
    script: [{ src: '/app.js', defer: true }],
  },
}))

vi.mock('@unhead/vue/server', async (importOriginal) => {
  const unhead = await importOriginal<typeof import('@unhead/vue/server')>()
  return {
    ...unhead,
    createHead: (options: Parameters<typeof unhead.createHead>[0]) => {
      const head = unhead.createHead(options)
      initialEntries.push([...head.entries.values()])
      return head
    },
  }
})

vi.mock('@unhead/vue/stream/server', async (importOriginal) => {
  const unhead = await importOriginal<typeof import('@unhead/vue/stream/server')>()
  return {
    ...unhead,
    createStreamableHead: (options: Parameters<typeof unhead.createStreamableHead>[0]) => {
      const result = unhead.createStreamableHead(options)
      initialEntries.push([...result.head.entries.values()])
      return result
    },
  }
})

afterEach(() => {
  config.streaming = false
  initialEntries.length = 0
})

async function renderHead (path: string, streaming: boolean) {
  config.streaming = streaming
  const { response, html } = await render(path, {
    getRouteRules: () => ({ ssr: true, streaming }),
  }, createEvent(path, { headers: { 'user-agent': 'Mozilla/5.0' } }))
  expect(response.status).toBe(200)
  return {
    htmlAttrs: html.match(/<html([^>]*)>/)![1]!.trim(),
    head: html.match(/<head>([\s\S]*?)<\/head>/)![1]!,
  }
}

function appHeadTags (entries: typeof initialEntries[number]) {
  return entries.find(entry => entry.input?.titleTemplate)?._precomputedTags
}

describe.each([
  ['buffered render', false],
  ['streamed render', true],
])('`app.head` in a %s', (_, streaming) => {
  it('is normalised once and reused across requests', async () => {
    await renderHead('/', streaming)
    await renderHead('/', streaming)

    expect(initialEntries).toHaveLength(2)
    const [first, second] = initialEntries.map(appHeadTags)
    expect(first).toBeDefined()
    expect(second).toBe(first)
  })

  it('renders the static entries', async () => {
    const { htmlAttrs, head } = await renderHead('/', streaming)

    expect(htmlAttrs).toBe('lang="en" class="app"')
    expect(head).toContain('<title>Standalone renderer · App site</title>')
    expect(head).toContain('<meta name="description" content="app description">')
    expect(head).toContain('<meta name="theme-color" content="#fff">')
    expect(head).toMatch(/<meta property="og:image" content="\/a.png">\s*<meta property="og:image" content="\/b.png">/)
    expect(head).toContain('<link rel="icon" href="/favicon.ico">')
    expect(head).toContain('<script src="/app.js" defer></script>')
  })

  it('is overridden by `useHead()` without leaking into other requests', async () => {
    const initial = await renderHead('/', streaming)
    const overridden = await renderHead('/head-override', streaming)

    expect(overridden.htmlAttrs).toBe('lang="fr" class="app page"')
    expect(overridden.head).toContain('<title>Standalone renderer · Page site</title>')
    expect(overridden.head.match(/name="description"/g)).toHaveLength(1)
    expect(overridden.head).toContain('<meta name="description" content="page description">')
    expect(overridden.head.match(/name="theme-color"/g)).toHaveLength(1)
    expect(overridden.head).toContain('<meta name="theme-color" content="#000">')

    expect(await renderHead('/', streaming)).toEqual(initial)
    expect(await renderHead('/head-override', streaming)).toEqual(overridden)
  })

  it('matches the output of normalising it per request', async () => {
    for (const path of ['/', '/head-override']) {
      const precomputed = await renderHead(path, streaming)
      const normalised = await renderHead(`${path}?normalize-hook`, streaming)
      expect(normalised).toEqual(precomputed)
    }
  })

  it('is normalised per request when an entry hook is registered', async () => {
    const initial = await renderHead('/', streaming)

    const hooked = await renderHead('/?rewrite-lang-hook', streaming)
    expect(hooked.htmlAttrs).toBe('lang="en-GB" class="app"')

    expect(await renderHead('/', streaming)).toEqual(initial)
  })
})
