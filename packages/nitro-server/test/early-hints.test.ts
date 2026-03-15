import { describe, expect, it } from 'vitest'

import { renderEarlyHintsFromLinks } from '../src/runtime/utils/renderer/early-hints'

describe('early hints renderer', () => {
  it('renders early hints from link entries, filtering to supported rels', () => {
    const links = [
      { rel: 'preconnect', href: 'https://cdn.example.com', crossorigin: '' },
      { rel: 'preload', href: '/app.js', as: 'script', fetchpriority: 'high' },
      { rel: 'stylesheet', href: '/style.css' },
      { rel: 'dns-prefetch', href: '//fonts.example.com' },
      { rel: 'icon', href: '/favicon.ico' },
    ]

    expect(renderEarlyHintsFromLinks(links)).toEqual([
      '<https://cdn.example.com>; rel=preconnect; crossorigin',
      '</app.js>; rel=preload; as="script"; fetchpriority="high"',
      '<//fonts.example.com>; rel=dns-prefetch',
    ])
  })

  it('skips links without href or rel', () => {
    expect(renderEarlyHintsFromLinks([
      { rel: 'preload' },
      { href: '/app.js' },
      {},
    ])).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(renderEarlyHintsFromLinks([])).toEqual([])
  })
})
