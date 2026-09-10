import { describe, expect, it } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

async function resolveTypeCheck (typeCheck: boolean | 'build' | 'dev', options: { dev: boolean, test: boolean }) {
  const result = await applyDefaults(NuxtConfigSchema, { typescript: { typeCheck }, ...options }) as unknown as NuxtOptions
  return result.typescript.typeCheck
}

describe('typescript.typeCheck', () => {
  it.each([
    [true, true, true],
    [true, false, true],
    ['build', true, false],
    ['build', false, true],
    ['dev', true, true],
    ['dev', false, false],
    [false, true, false],
    [false, false, false],
  ] as const)('typeCheck: %s, dev: %s -> %s', async (typeCheck, dev, expected) => {
    expect(await resolveTypeCheck(typeCheck, { dev, test: false })).toBe(expected)
  })

  it('always resolves to false in test mode', async () => {
    for (const typeCheck of [true, false, 'build', 'dev'] as const) {
      expect(await resolveTypeCheck(typeCheck, { dev: true, test: true })).toBe(false)
      expect(await resolveTypeCheck(typeCheck, { dev: false, test: true })).toBe(false)
    }
  })
})
