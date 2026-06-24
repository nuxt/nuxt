import { describe, expect, it, vi } from 'vitest'

import { buildDiagnostics } from '../src/diagnostics/build.ts'
import { pluginDiagnostics } from '../src/diagnostics/plugins.ts'
import { componentDiagnostics } from '../src/diagnostics/components.ts'
import { pageDiagnostics } from '../src/diagnostics/pages.ts'
import { configDiagnostics } from '../src/diagnostics/config.ts'
import { headDiagnostics } from '../src/diagnostics/head.ts'
import { bundlerDiagnostics } from '../src/diagnostics/bundler.ts'
import { kitDiagnostics } from '../src/diagnostics/kit-api.ts'

const catalogs = {
  'build': buildDiagnostics,
  'plugins': pluginDiagnostics,
  'components': componentDiagnostics,
  'pages': pageDiagnostics,
  'config': configDiagnostics,
  'head': headDiagnostics,
  'bundler': bundlerDiagnostics,
  'kit-api': kitDiagnostics,
}

describe('build diagnostics catalog', () => {
  it('exposes a callable handle per code, all matching NUXT_B<NNNN>', () => {
    const allCodes = Object.values(catalogs).flatMap(c => Object.keys(c))
    expect(allCodes.length).toBe(105)
    for (const code of allCodes) {
      expect(code, `${code} should be a NUXT_B code`).toMatch(/^NUXT_B\d{4}$/)
    }
  })

  it('has no duplicate codes across domain catalogs', () => {
    const allCodes = Object.values(catalogs).flatMap(c => Object.keys(c))
    expect(new Set(allCodes).size).toBe(allCodes.length)
  })

  for (const [name, catalog] of Object.entries(catalogs)) {
    it(`every ${name} handle builds a Diagnostic whose name is its code`, () => {
      // Calling a handle fires the console reporter; silence it for the sweep.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // Feed a string to any named param a why/fix template reads, but leave
      // nostics' reserved runtime fields (sources/cause) untouched.
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
