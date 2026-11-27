import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefetchGroup } from '../src/app/internal/prefetch-util'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('prefetchGroup', () => {
  it.each([
    ['https://example.com/preview/index.html', 'https://example.com/preview/index.html'],
    ['about:srcdoc', 'https://example.com/preview/index.html'],
    ['about:blank', 'https://example.com/preview/index.html'],
    ['https://example.com/editor', 'https://example.com/preview/index.html'],
  ])('resolves paths with location %s and document base %s', (href, baseURI) => {
    vi.stubGlobal('window', { location: new URL(href) })
    vi.stubGlobal('document', { baseURI })

    expect(prefetchGroup('/products?sort=price#details')).toBe('/products?sort=price')
    expect(prefetchGroup('products?sort=price#details')).toBe('/preview/products?sort=price')
    expect(prefetchGroup('?sort=price#details')).toBe('/preview/index.html?sort=price')
    expect(prefetchGroup('#details')).toBe('/preview/index.html')
    expect(prefetchGroup('https://example.com/products?sort=price#details')).toBe('/products?sort=price')
  })
})
