import { describe, expect, it } from 'vitest'
import { isCrossOriginURL } from '../src/app/internal/origin'

describe('isCrossOriginURL', () => {
  const base = new URL('https://example.com/about')

  it.each([
    ['/about/_payload.json', false],
    ['https://example.com/about/_payload.json', false],
    ['//example.com/about/_payload.json', false],
    ['https://example.com:443/about/_payload.json', false],
    ['https://cdn.example.com/about/_payload.json', true],
    ['//cdn.example.com/about/_payload.json', true],
    ['http://example.com/about/_payload.json', true],
    ['https://example.com:8080/about/_payload.json', true],
  ])('%s is %s', (url, expected) => {
    expect(isCrossOriginURL(url, base)).toBe(expected)
  })
})
