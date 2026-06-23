import { describe, expect, it } from 'vitest'
import { Diagnostic } from 'nostics'

import { diagnostics } from '../src/diagnostics.ts'
import { normalizePlugin } from '../src/plugin.ts'

describe('build diagnostics', () => {
  it('builds a Diagnostic with a stable code, interpolated why and fix', () => {
    const d = diagnostics.NUXT_B2011({ src: '/plugins/bad.ts' })
    expect(d).toBeInstanceOf(Diagnostic)
    expect(d.name).toBe('NUXT_B2011')
    expect(d.message).toContain('/plugins/bad.ts')
    expect(d.fix).toContain('addPlugin()')
    expect(d.docs).toBe('https://nuxt.com/docs/4.x/errors/b2011')
  })

  it('is throwable and catchable as a Diagnostic', () => {
    try {
      throw diagnostics.NUXT_B2011({ src: '/plugins/bad.ts' })
    } catch (err) {
      expect(err).toBeInstanceOf(Diagnostic)
      expect((err as Diagnostic).name).toBe('NUXT_B2011')
    }
  })

  it('normalizePlugin throws NUXT_B2011 when src is missing', () => {
    let caught: unknown
    try {
      // @ts-expect-error intentionally invalid plugin
      normalizePlugin({ mode: 'all' })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Diagnostic)
    expect((caught as Diagnostic).name).toBe('NUXT_B2011')
  })
})
