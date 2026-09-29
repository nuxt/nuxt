import { describe, expect, it } from 'vitest'

// Build-time (NUXT_B) catalogs.
import { buildDiagnostics, bundlerDiagnostics, componentDiagnostics, configDiagnostics, headDiagnostics, pageDiagnostics, pluginDiagnostics } from '@nuxt/kit/internal'
// The B8xxx kit-api catalog is intentionally kit-internal, so reach for it directly.
import { kitDiagnostics } from '../../kit/src/diagnostics/kit-api.ts'

// Runtime (NUXT_E) catalogs.
import { appDiagnostics } from '../src/app/diagnostics/core.ts'
import { navigationDiagnostics } from '../src/app/diagnostics/navigation.ts'
import { dataDiagnostics } from '../src/app/diagnostics/data.ts'
import { renderDiagnostics } from '../src/app/diagnostics/render.ts'
import { manifestDiagnostics } from '../src/app/diagnostics/manifest.ts'
import { unheadDiagnostics } from '../src/app/diagnostics/head.ts'
import { stateDiagnostics } from '../src/app/diagnostics/state.ts'
import { serverDiagnostics } from '../../nitro-server/src/runtime/diagnostics.ts'

// Schema continues kit's B5xxx configuration range, so it has to be swept too.
import { schemaDiagnostics } from '../../schema/src/diagnostics.ts'

const catalogs = {
  buildDiagnostics,
  pluginDiagnostics,
  componentDiagnostics,
  pageDiagnostics,
  configDiagnostics,
  headDiagnostics,
  bundlerDiagnostics,
  kitDiagnostics,
  appDiagnostics,
  navigationDiagnostics,
  dataDiagnostics,
  renderDiagnostics,
  manifestDiagnostics,
  unheadDiagnostics,
  stateDiagnostics,
  serverDiagnostics,
  schemaDiagnostics,
}

describe('diagnostics catalog', () => {
  it('has no duplicate codes across every catalog', () => {
    // Codes live in separate defineDiagnostics() calls, so nothing but this
    // global sweep can catch two diagnostics sharing a code.
    const owners = new Map<string, string[]>()
    for (const [name, catalog] of Object.entries(catalogs)) {
      for (const code of Object.keys(catalog)) {
        owners.set(code, [...owners.get(code) || [], name])
      }
    }

    const duplicates = [...owners]
      .filter(([_code, names]) => names.length > 1)
      .map(([code, names]) => `${code} is defined in ${names.join(' and ')}`)

    expect(duplicates).toStrictEqual([])
  })

  it.each(Object.entries(catalogs))('%s lists its codes in ascending order', (_name, catalog) => {
    // Gaps are fine; a code filed out of order is how two catalogs end up
    // claiming the same number without anyone noticing in review.
    const codes = Object.keys(catalog)
    expect(codes).toStrictEqual([...codes].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })))
  })
})
