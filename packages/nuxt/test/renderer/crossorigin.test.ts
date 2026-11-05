import { describe, expect, it } from 'vitest'

import { applyCrossOriginToLinkHeader, crossOriginAttribute, getAssetCrossOrigin, withAssetCrossOrigin } from '../../src/runtime/server/renderer/crossorigin.ts'

describe('getAssetCrossOrigin', () => {
  it('returns the configured value', () => {
    expect(getAssetCrossOrigin({ app: { crossOrigin: 'use-credentials' } })).toBe('use-credentials')
    expect(getAssetCrossOrigin({ app: { crossOrigin: 'anonymous' } })).toBe('anonymous')
  })

  it('falls back to the default for missing or invalid values', () => {
    expect(getAssetCrossOrigin({ app: { crossOrigin: '' } })).toBe('')
    expect(getAssetCrossOrigin({ app: {} })).toBe('')
    expect(getAssetCrossOrigin({})).toBe('')
    expect(getAssetCrossOrigin()).toBe('')
    expect(getAssetCrossOrigin({ app: { crossOrigin: 'bogus' } })).toBe('')
  })
})

describe('withAssetCrossOrigin', () => {
  it('overrides links that already carry a crossorigin', () => {
    const link = { rel: 'modulepreload', as: 'script', crossorigin: '', href: '/_nuxt/entry.js' }
    expect(withAssetCrossOrigin(link, 'use-credentials')).toEqual({ ...link, crossorigin: 'use-credentials' })
    // the default leaves the link untouched
    expect(withAssetCrossOrigin(link, '')).toBe(link)
  })

  it('leaves links without a crossorigin untouched', () => {
    const link = { rel: 'preload', as: 'fetch', crossorigin: null, href: '/_payload.json' }
    expect(withAssetCrossOrigin(link, 'use-credentials')).toBe(link)
  })
})

describe('applyCrossOriginToLinkHeader', () => {
  it('replaces bare crossorigin segments', () => {
    const header = '</_nuxt/entry.js>; rel="modulepreload"; as="script"; crossorigin, </_nuxt/entry.css>; rel="preload"; as="style"; crossorigin'
    expect(applyCrossOriginToLinkHeader(header, 'use-credentials')).toBe('</_nuxt/entry.js>; rel="modulepreload"; as="script"; crossorigin="use-credentials", </_nuxt/entry.css>; rel="preload"; as="style"; crossorigin="use-credentials"')
  })

  it('leaves the header untouched for the default', () => {
    const header = '</_nuxt/entry.js>; rel="modulepreload"; as="script"; crossorigin'
    expect(applyCrossOriginToLinkHeader(header, '')).toBe(header)
  })
})

describe('crossOriginAttribute', () => {
  it('renders a bare attribute for the default', () => {
    expect(crossOriginAttribute('')).toBe(' crossorigin')
  })

  it('renders the configured value', () => {
    expect(crossOriginAttribute('use-credentials')).toBe(' crossorigin="use-credentials"')
  })
})
