import { describe, expect, it } from 'vitest'

import { parseRequestPath, payloadRequestToRoute, routeToPayloadURL, withRequestPath } from '../../src/runtime/server/renderer/url.ts'

describe('payload request paths', () => {
  it.each([
    ['//x/isr/_payload.json', '//x/isr'],
    ['///x/isr/_payload.json', '///x/isr'],
    ['//x/isr/_payload.json?page=2&_b=abc', '//x/isr?page=2'],
  ])('maps %s to %s', (path, route) => {
    expect(payloadRequestToRoute(path)).toBe(route)
  })

  it('maps a `_payload.js` request to its route', () => {
    expect(payloadRequestToRoute('//x/isr/_payload.js?_b=abc', '_payload.js')).toBe('//x/isr')
  })

  it('keeps a leading `//` in the parsed pathname', () => {
    expect(parseRequestPath('//x/isr?a=1').pathname).toBe('//x/isr')
  })

  it.each([
    ['/', '//evil.com/x', '/evil.com/x/_payload.json?_b=id'],
    ['/', '///evil.com/x?a=1', '/evil.com/x/_payload.json?a=1&_b=id'],
    ['/base/', '//evil.com/x', '/base/evil.com/x/_payload.json?_b=id'],
    ['/', '/foo', '/foo/_payload.json?_b=id'],
    ['/', '/', '/_payload.json?_b=id'],
    ['/', '/foo/', '/foo/_payload.json?_b=id'],
    ['/base', '/foo', '/base/foo/_payload.json?_b=id'],
    ['https://cdn.example.com/', '/foo', 'https://cdn.example.com/foo/_payload.json?_b=id'],
  ])('builds a same-origin payload url from %s + %s', (baseURL, path, expected) => {
    expect(routeToPayloadURL(baseURL, path, 'id')).toBe(expected)
  })

  it('builds a `_payload.js` url', () => {
    expect(routeToPayloadURL('/', '//evil.com/x', 'id', '_payload.js')).toBe('/evil.com/x/_payload.js?_b=id')
  })
})

describe('request path rewrites', () => {
  it.each([
    ['//evil.com/x', 'https://nuxt.com//evil.com/x'],
    ['//evil.com/x?a=1', 'https://nuxt.com//evil.com/x?a=1'],
    ['/foo', 'https://nuxt.com/foo'],
  ])('keeps the origin when rewriting to %s', (path, expected) => {
    expect(withRequestPath(new URL('https://nuxt.com/foo/_payload.json?_b=id'), path).href).toBe(expected)
  })
})
