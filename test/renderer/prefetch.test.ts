import { describe, expect, it, vi } from 'vitest'
import { BUILD_ASSETS_DIR, createEvent, render } from './harness'

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  NUXT_SSR_STREAMING: true,
}))

function renderPage (rules: Record<string, unknown>) {
  return render('/', { getRouteRules: () => ({ ssr: true, ...rules }) }, createEvent('/', { headers: { 'user-agent': 'Mozilla/5.0' } }))
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
})

describe('prefetch hints of a noScripts route', () => {
  it('are rendered with an href', async () => {
    const { html } = await renderPage({ noScripts: true })

    expect(html).not.toContain('__NUXT_DATA__')
    expect(prefetchLinks(html)).toContainEqual(expect.stringMatching(/ href="[^"]*DeferredPanel[^"]*\.css"/))
    expect(html).not.toContain('data-href')
  })
})
