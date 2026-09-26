import { describe, expect, it } from 'vitest'

import { parseRequestPath, payloadRequestToRoute, routeToPayloadURL } from '../../src/runtime/server/renderer/url.ts'

describe('payload request paths', () => {
  it.each([
    ['//x/isr/_payload.json', '//x/isr'],
    ['///x/isr/_payload.json', '///x/isr'],
    ['//x/isr/_payload.json?page=2&_b=abc', '//x/isr?page=2'],
  ])('maps %s to %s', (path, route) => {
    expect(payloadRequestToRoute(path)).toBe(route)
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
})
