import { describe, expect, it } from 'vitest'

import { extractLinkTagAttributes, renderEarlyHintsFromHeadTags } from './early-hints'

describe('early hints renderer', () => {
  it('extracts link tag attributes from rendered head html', () => {
    expect(extractLinkTagAttributes('<link rel="preconnect" href="https://cdn.example.com" crossorigin><link rel="stylesheet" href="/style.css">')).toEqual([
      {
        crossorigin: '',
        href: 'https://cdn.example.com',
        rel: 'preconnect',
      },
      {
        href: '/style.css',
        rel: 'stylesheet',
      },
    ])
  })

  it('renders only supported network hints as Link headers', () => {
    const headTags = [
      '<meta charset="utf-8">',
      '<link rel="preconnect" href="https://cdn.example.com" crossorigin>',
      '<link rel="preload" href="/app.js" as="script" fetchpriority="high">',
      '<link rel="stylesheet" href="/style.css">',
      '<link rel="dns-prefetch" href="//fonts.example.com">',
    ].join('')

    expect(renderEarlyHintsFromHeadTags(headTags)).toEqual([
      '<https://cdn.example.com>; rel=preconnect; crossorigin',
      '</app.js>; rel=preload; as="script"; fetchpriority="high"',
      '<//fonts.example.com>; rel=dns-prefetch',
    ])
  })
})
