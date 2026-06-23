import { describe, expect, it } from 'vitest'
import { Diagnostic } from 'nostics'

import { pluginDiagnostics } from '../src/diagnostics/plugins.ts'
import { normalizePlugin } from '../src/plugin.ts'

describe('build diagnostics', () => {
  it('builds a Diagnostic with a stable code, interpolated why and fix', () => {
    const d = pluginDiagnostics.NUXT_B2011({ src: '/plugins/bad.ts' })
    expect(d).toBeInstanceOf(Diagnostic)
    expect(d.name).toBe('NUXT_B2011')
    expect(d.message).toContain('/plugins/bad.ts')
    expect(d.fix).toContain('addPlugin()')
  })

  it('opts out of a docs URL when the code has no dedicated page (docs: false)', () => {
    const d = pluginDiagnostics.NUXT_B2011({ src: '/plugins/bad.ts' })
    expect(d.docs).toBeUndefined()
  })

  it('is throwable and catchable as a Diagnostic', () => {
    try {
      throw pluginDiagnostics.NUXT_B2011({ src: '/plugins/bad.ts' })
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
