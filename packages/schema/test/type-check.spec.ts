import { describe, expect, it } from 'vitest'

import { shouldEnableTypeCheck } from '../src/index.ts'

describe('shouldEnableTypeCheck', () => {
  it.each([
    [true, true, true],
    [true, false, true],
    ['build', true, false],
    ['build', false, true],
    ['dev', true, true],
    ['dev', false, false],
    [false, true, false],
    [false, false, false],
  ] as const)('typeCheck: %s, dev: %s -> %s', (typeCheck, dev, expected) => {
    expect(shouldEnableTypeCheck(typeCheck, { dev })).toBe(expected)
  })

  it('always returns false in test mode', () => {
    for (const typeCheck of [true, false, 'build', 'dev'] as const) {
      expect(shouldEnableTypeCheck(typeCheck, { dev: true, test: true })).toBe(false)
      expect(shouldEnableTypeCheck(typeCheck, { dev: false, test: true })).toBe(false)
    }
  })
})
