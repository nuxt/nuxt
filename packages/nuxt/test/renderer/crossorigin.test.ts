import { describe, expect, it } from 'vitest'

import { applyBuildAssetsCrossOrigin, applyBuildAssetsCrossOriginHeader, buildAssetsCrossoriginHtmlAttr } from '../../src/runtime/server/renderer/crossorigin.ts'

describe('applyBuildAssetsCrossOrigin', () => {
  const hints = [
    { rel: 'modulepreload', href: '/_nuxt/entry.js', crossorigin: '' as const },
    { rel: 'preload', href: '/_nuxt/entry.css', as: 'style', crossorigin: '' as const },
    { rel: 'preload', href: '/_nuxt/font.woff2', as: 'font', crossorigin: 'anonymous' as const },
    { rel: 'preload', href: '/img.png', as: 'image', crossorigin: null },
  ]

  it('leaves anonymous CORS unchanged by default', () => {
    expect(applyBuildAssetsCrossOrigin(hints, '')).toEqual(hints)
  })

  it('rewrites anonymous hints to use-credentials when configured', () => {
    expect(applyBuildAssetsCrossOrigin(hints, 'use-credentials')).toEqual([
      { rel: 'modulepreload', href: '/_nuxt/entry.js', crossorigin: 'use-credentials' },
      { rel: 'preload', href: '/_nuxt/entry.css', as: 'style', crossorigin: 'use-credentials' },
      { rel: 'preload', href: '/_nuxt/font.woff2', as: 'font', crossorigin: 'use-credentials' },
      { rel: 'preload', href: '/img.png', as: 'image', crossorigin: null },
    ])
  })

  it('emits explicit anonymous when that value is configured', () => {
    expect(applyBuildAssetsCrossOrigin(hints, 'anonymous').map(h => h.crossorigin)).toEqual([
      'anonymous',
      'anonymous',
      'anonymous',
      null,
    ])
  })
})

describe('buildAssetsCrossoriginHtmlAttr', () => {
  it('keeps a bare crossorigin attribute for the default anonymous mode', () => {
    expect(buildAssetsCrossoriginHtmlAttr('')).toBe(' crossorigin')
  })

  it('emits use-credentials when configured', () => {
    expect(buildAssetsCrossoriginHtmlAttr('use-credentials')).toBe(' crossorigin="use-credentials"')
    expect(buildAssetsCrossoriginHtmlAttr('anonymous')).toBe(' crossorigin="anonymous"')
  })
})

describe('applyBuildAssetsCrossOriginHeader', () => {
  const header = '</_nuxt/entry.js>; rel="modulepreload"; crossorigin, </img.png>; rel="preload"; as="image"'

  it('leaves Link headers unchanged by default', () => {
    expect(applyBuildAssetsCrossOriginHeader(header, '')).toBe(header)
  })

  it('rewrites crossorigin tokens when credentials are required', () => {
    expect(applyBuildAssetsCrossOriginHeader(header, 'use-credentials'))
      .toBe('</_nuxt/entry.js>; rel="modulepreload"; crossorigin="use-credentials", </img.png>; rel="preload"; as="image"')
  })
})
