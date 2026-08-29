import { describe, expect, it } from 'vitest'
import { shouldTypeCheck } from '../src/utils/type-check.ts'

describe('shouldTypeCheck', () => {
  it('enables type checking in both dev and build when configured as true', () => {
    expect(shouldTypeCheck(true, true)).toBe(true)
    expect(shouldTypeCheck(true, false)).toBe(true)
  })

  it('enables type checking only in build when configured as build', () => {
    expect(shouldTypeCheck('build', true)).toBe(false)
    expect(shouldTypeCheck('build', false)).toBe(true)
  })

  it('enables type checking only in dev when configured as dev', () => {
    expect(shouldTypeCheck('dev', true)).toBe(true)
    expect(shouldTypeCheck('dev', false)).toBe(false)
  })

  it('disables type checking when configured as false', () => {
    expect(shouldTypeCheck(false, true)).toBe(false)
    expect(shouldTypeCheck(false, false)).toBe(false)
  })
})
