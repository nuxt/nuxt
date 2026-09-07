import { describe, expect, it } from 'vitest'
import { Diagnostic } from 'nostics'

import { normalizePlugin } from '../src/plugin.ts'

describe('normalizePlugin', () => {
  it('throws when src is missing', () => {
    let caught: unknown
    try {
      // @ts-expect-error intentionally invalid plugin
      normalizePlugin({ mode: 'all' })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Diagnostic)
    expect((caught as Diagnostic).name).toBe('NUXT_B2011')
    expect((caught as Diagnostic).fix).toContain('addPlugin()')
  })
})
