import { describe, expect, it } from 'vitest'

// Build-time (NUXT_B) catalogs: the public ones come through the kit barrel.
import {
  buildDiagnostics,
  bundlerDiagnostics,
  componentDiagnostics,
  configDiagnostics,
  headDiagnostics,
  pageDiagnostics,
  pluginDiagnostics,
} from '@nuxt/kit'
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

const catalogs = [
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
]

describe('diagnostics catalog', () => {
  it('has no duplicate codes across every catalog', () => {
    // Codes live in separate defineDiagnostics() calls, so nothing but this
    // global sweep can catch two diagnostics sharing a code.
    const allCodes = catalogs.flatMap(c => Object.keys(c))
    expect(new Set(allCodes).size).toBe(allCodes.length)
  })
})
