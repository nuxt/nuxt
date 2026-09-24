import { describe, expect, it } from 'vitest'

import { parseRequestPath, payloadRequestToRoute } from '../../src/runtime/server/renderer/url.ts'

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
})
