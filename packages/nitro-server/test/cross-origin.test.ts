import { describe, expect, it } from 'vitest'
import { applyCrossOriginToLinkHeader, normalizeCrossOrigin, renderCrossOriginAttr, withCrossOrigin } from '../src/runtime/utils/renderer/cross-origin'

describe('renderer cross-origin helpers', () => {
  it('normalizes supported crossOrigin values', () => {
    expect(normalizeCrossOrigin('anonymous')).toBe('anonymous')
    expect(normalizeCrossOrigin('use-credentials')).toBe('use-credentials')
    expect(normalizeCrossOrigin('invalid')).toBe('')
    expect(normalizeCrossOrigin(undefined)).toBe('')
  })

  it('updates generated bundle-renderer links that already require crossorigin', () => {
    const links = withCrossOrigin([
      { rel: 'modulepreload', crossorigin: '', href: '/_nuxt/app.js' },
      { rel: 'preload', crossorigin: null, href: '/_nuxt/app.woff2' },
      { rel: 'stylesheet', crossorigin: '', href: '/_nuxt/app.css' },
    ], 'use-credentials')

    expect(links).toEqual([
      { rel: 'modulepreload', crossorigin: 'use-credentials', href: '/_nuxt/app.js' },
      { rel: 'preload', crossorigin: null, href: '/_nuxt/app.woff2' },
      { rel: 'stylesheet', crossorigin: 'use-credentials', href: '/_nuxt/app.css' },
    ])
  })

  it('renders the HTML crossorigin attribute without changing the default output', () => {
    expect(renderCrossOriginAttr('')).toBe(' crossorigin')
    expect(renderCrossOriginAttr('use-credentials')).toBe(' crossorigin="use-credentials"')
  })

  it('updates crossorigin in HTTP link headers', () => {
    const header = '</_nuxt/app.js>; rel="modulepreload"; crossorigin, </_nuxt/app.css>; rel="preload"; as="style"; crossorigin=anonymous'

    expect(applyCrossOriginToLinkHeader(header, 'use-credentials')).toBe('</_nuxt/app.js>; rel="modulepreload"; crossorigin=use-credentials, </_nuxt/app.css>; rel="preload"; as="style"; crossorigin=use-credentials')
    expect(applyCrossOriginToLinkHeader(header, '')).toBe(header)
  })
})
