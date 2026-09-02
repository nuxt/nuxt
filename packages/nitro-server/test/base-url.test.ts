import { FastURL } from 'srvx/node'
import { describe, expect, it } from 'vitest'

import { urlHash, withoutBaseURL } from '../src/runtime/utils/base.ts'

// `srvx` builds the URL of an incoming request from its parts on Node, and hands over the platform
// `URL` on runtimes it has no fast path for (workerd, and anything using the generic adapter).
const requestURL = (path: string) => new (FastURL as unknown as new (init: unknown) => URL)({
  protocol: 'https:',
  host: 'example.com',
  pathname: path.split('?')[0],
  search: path.includes('?') ? path.slice(path.indexOf('?')) : '',
})
const platformURL = (path: string) => new URL(`https://example.com${path}`)

describe.each([
  ['srvx request url', requestURL],
  ['platform url', platformURL],
])('withoutBaseURL (%s)', (_name, url) => {
  it.each([
    ['/foo/bar', '/bar', 'https://example.com/bar'],
    ['/foo/deep/nested?a=1&b=2', '/deep/nested', 'https://example.com/deep/nested?a=1&b=2'],
    ['/foo', '/', 'https://example.com/'],
    ['/foo/', '/', 'https://example.com/'],
    ['/foo/bar#frag', '/bar', 'https://example.com/bar#frag'],
  ])('%s -> %s', (path, pathname, href) => {
    const stripped = withoutBaseURL(url(path), '/foo')
    expect(stripped.pathname).toBe(pathname)
    expect(stripped.href).toBe(href)
  })

  it('keeps the origin of the request', () => {
    expect(withoutBaseURL(new URL('http://localhost:3000/foo/bar'), '/foo').href).toBe('http://localhost:3000/bar')
    expect(withoutBaseURL(new URL('http://[::1]:3000/foo/bar'), '/foo').href).toBe('http://[::1]:3000/bar')
  })
})

describe('urlHash', () => {
  it('reads the fragment of a url that has one', () => {
    expect(urlHash(new URL('https://example.com/a?b=1#frag'))).toBe('#frag')
  })

  it('is empty for a request url, which cannot carry one', () => {
    expect(urlHash(requestURL('/a?b=1'))).toBe('')
  })
})
