import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUILD_ASSETS_DIR, createEvent, render } from './harness'

const config = vi.hoisted(() => ({ deferPrefetchHints: true }))

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  NUXT_SSR_STREAMING: true,
  get NUXT_DEFER_PREFETCH_HINTS () { return config.deferPrefetchHints },
}))

afterEach(() => {
  config.deferPrefetchHints = true
})

async function renderPage (rules: Record<string, unknown>) {
  const earlyHints: string[] = []
  const { response, html } = await render('/', {
    getRouteRules: () => ({ ssr: true, ...rules }),
    writeEarlyHints: (_event, hint) => { earlyHints.push(hint.link) },
  }, createEvent('/', { headers: { 'user-agent': 'Mozilla/5.0' } }))
  return { html, earlyHints, linkHeader: response.headers.get('link') }
}

function prefetchLinks (html: string) {
  const head = html.match(/<head>([\s\S]*)<\/head>/)![1]!
  return [...head.matchAll(/<link [^>]*rel="prefetch"[^>]*>/g)].map(m => m[0])
}

describe.each([
  ['buffered render', { ssr: true, streaming: false }],
  ['streamed render', { ssr: true, streaming: true }],
  ['spa shell', { ssr: false, streaming: false }],
])('prefetch hints of a %s', (_, rules) => {
  it('are rendered without an href', async () => {
    const { html } = await renderPage(rules)

    expect(html.includes('window.__unhead__')).toBe(rules.streaming)
    const links = prefetchLinks(html)
    expect(links.filter(link => / href=/.test(link))).toEqual([])
    expect(links).toContainEqual(expect.stringMatching(new RegExp(`as="script".* data-href="${BUILD_ASSETS_DIR}[^"]+\\.js"`)))
    expect(links).toContainEqual(expect.stringMatching(new RegExp(`as="style".* data-href="${BUILD_ASSETS_DIR}DeferredPanel[^"]*\\.css"`)))
  })

  it('are left out of the early hints and link header', async () => {
    const { earlyHints, linkHeader } = await renderPage(rules)

    expect(earlyHints).toHaveLength(1)
    for (const link of rules.streaming ? [...earlyHints, linkHeader] : earlyHints) {
      expect(link).toContain('rel="modulepreload"')
      expect(link).not.toContain('rel="prefetch"')
    }
  })
})

describe('prefetch hints with `experimental.deferPrefetchHints` disabled', () => {
  it.each([
    ['buffered render', { ssr: true, streaming: false }],
    ['streamed render', { ssr: true, streaming: true }],
  ])('are rendered with an href in a %s', async (_, rules) => {
    config.deferPrefetchHints = false
    const { html } = await renderPage(rules)

    expect(html).not.toContain('data-href')
    expect(prefetchLinks(html)).toContainEqual(expect.stringMatching(new RegExp(`as="script".* href="${BUILD_ASSETS_DIR}[^"]+\\.js"`)))
  })

  it.each([
    ['buffered render', { ssr: true, streaming: false }],
    ['streamed render', { ssr: true, streaming: true }],
  ])('are sent in the early hints and link header of a %s', async (_, rules) => {
    config.deferPrefetchHints = false
    const { earlyHints, linkHeader } = await renderPage(rules)

    for (const link of rules.streaming ? [...earlyHints, linkHeader] : earlyHints) {
      expect(link).toMatch(new RegExp(`<${BUILD_ASSETS_DIR}[^>]+\\.js>; rel="prefetch"; as="script"`))
    }
  })
})

describe('prefetch hints of a noScripts route', () => {
  it('are rendered with an href', async () => {
    const { html } = await renderPage({ noScripts: true })

    expect(html).not.toContain('__NUXT_DATA__')
    expect(prefetchLinks(html)).toContainEqual(expect.stringMatching(/ href="[^"]*DeferredPanel[^"]*\.css"/))
    expect(html).not.toContain('data-href')
  })

  it('are sent in the early hints', async () => {
    const { earlyHints } = await renderPage({ noScripts: true })

    expect(earlyHints[0]).toMatch(/DeferredPanel[^>]*\.css>; rel="prefetch"; as="style"/)
  })
})
