import { describe, expect, it, vi } from 'vitest'

import { appDiagnostics } from '../src/app/diagnostics/core.ts'
import { navigationDiagnostics } from '../src/app/diagnostics/navigation.ts'
import { dataDiagnostics } from '../src/app/diagnostics/data.ts'
import { renderDiagnostics } from '../src/app/diagnostics/render.ts'
import { manifestDiagnostics } from '../src/app/diagnostics/manifest.ts'
import { unheadDiagnostics } from '../src/app/diagnostics/head.ts'
import { stateDiagnostics } from '../src/app/diagnostics/state.ts'

const catalogs = {
  core: appDiagnostics,
  navigation: navigationDiagnostics,
  data: dataDiagnostics,
  render: renderDiagnostics,
  manifest: manifestDiagnostics,
  head: unheadDiagnostics,
  state: stateDiagnostics,
}

describe('runtime diagnostics catalog', () => {
  it('exposes a callable handle per code, all matching NUXT_E<NNNN>', () => {
    const allCodes = Object.values(catalogs).flatMap(c => Object.keys(c))
    expect(allCodes.length).toBe(62)
    for (const code of allCodes) {
      expect(code, `${code} should be a NUXT_E code`).toMatch(/^NUXT_E\d{4}$/)
    }
  })

  it('has no duplicate codes across domain catalogs', () => {
    const allCodes = Object.values(catalogs).flatMap(c => Object.keys(c))
    expect(new Set(allCodes).size).toBe(allCodes.length)
  })

  for (const [name, catalog] of Object.entries(catalogs)) {
    it(`every ${name} handle builds a Diagnostic whose name is its code`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const params = new Proxy({}, {
        get: (_t, key) => (key === 'sources' || key === 'cause' || typeof key === 'symbol') ? undefined : 'x',
      })
      try {
        for (const code of Object.keys(catalog)) {
          const handle = (catalog as unknown as Record<string, (p?: Record<string, unknown>) => { name: string, message: string }>)[code]!
          const d = handle(params)
          expect(d.name).toBe(code)
          expect(typeof d.message).toBe('string')
          expect(d.message.length).toBeGreaterThan(0)
        }
      } finally {
        warn.mockRestore()
      }
    })
  }
})
