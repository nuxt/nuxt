import { afterEach, describe, expect, it, vi } from 'vitest'
import { HtmlValidate } from 'html-validate'
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

const validator = new HtmlValidate({
  extends: ['html-validate:document', 'html-validate:recommended', 'html-validate:standard'],
  rules: { 'require-sri': 'off' },
})

const DEFERRED_RE = /<template data-nuxt-prefetch>([\s\S]*?)<\/template>/

async function renderPage (rules: Record<string, unknown>) {
  const earlyHints: string[] = []
  const { response, html } = await render('/', {
    getRouteRules: () => ({ ssr: true, ...rules }),
    writeEarlyHints: (_event, hint) => { earlyHints.push(hint.link) },
  }, createEvent('/', { headers: { 'user-agent': 'Mozilla/5.0' } }))
  return { html, earlyHints, linkHeader: response.headers.get('link') }
}

function head (html: string) {
  return html.match(/<head>([\s\S]*)<\/head>/)![1]!
}

function prefetchLinks (html: string) {
  return [...html.matchAll(/<link [^>]*rel="prefetch"[^>]*>/g)].map(m => m[0])
}

describe.each([
  ['buffered render', { ssr: true, streaming: false }],
  ['streamed render', { ssr: true, streaming: true }],
  ['spa shell', { ssr: false, streaming: false }],
])('prefetch hints of a %s', (_, rules) => {
  it('are rendered in an inert template', async () => {
    const { html } = await renderPage(rules)

    expect(html.includes('window.__unhead__')).toBe(rules.streaming)
    expect(prefetchLinks(head(html).replace(DEFERRED_RE, ''))).toEqual([])
    const links = prefetchLinks(head(html).match(DEFERRED_RE)?.[1] ?? '')
    expect(links).toContainEqual(expect.stringMatching(new RegExp(`as="script".* href="${BUILD_ASSETS_DIR}[^"]+\\.js"`)))
    expect(links).toContainEqual(expect.stringMatching(new RegExp(`as="style".* href="${BUILD_ASSETS_DIR}DeferredPanel[^"]*\\.css"`)))
  })

  it('render valid HTML', async () => {
    const { html } = await renderPage(rules)

    const report = await validator.validateString(html)
    expect(report.results).toEqual([])
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

    expect(html).not.toMatch(DEFERRED_RE)
    expect(prefetchLinks(head(html))).toContainEqual(expect.stringMatching(new RegExp(`as="script".* href="${BUILD_ASSETS_DIR}[^"]+\\.js"`)))
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
    expect(prefetchLinks(head(html))).toContainEqual(expect.stringMatching(/ href="[^"]*DeferredPanel[^"]*\.css"/))
    expect(html).not.toMatch(DEFERRED_RE)
  })

  it('are sent in the early hints', async () => {
    const { earlyHints } = await renderPage({ noScripts: true })

    expect(earlyHints[0]).toMatch(/DeferredPanel[^>]*\.css>; rel="prefetch"; as="style"/)
  })
})
