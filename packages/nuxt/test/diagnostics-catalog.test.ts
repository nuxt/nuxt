import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { glob } from 'tinyglobby'
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
import { nitroBuildDiagnostics } from '../../nitro-server/src/diagnostics.ts'
import { rendererDiagnostics } from '../src/runtime/server/renderer/diagnostics.ts'

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
  nitroBuildDiagnostics,
  rendererDiagnostics,
  schemaDiagnostics,
}

const packagesDir = fileURLToPath(new URL('../..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

/** Codes defined on `origin/4.x` that main does not define, each with the reason. */
const FOURX_ONLY: Record<string, string> = {}

const CATALOG_GLOB = '*/src/**/*.ts'
const CODE_WHY_RE = /\b(NUXT_[A-Z]\d{4}):\s*\{\s*why:\s*([^\n]*)/g

function extractCodes (sources: string[]) {
  const codes = new Map<string, string>()
  for (const source of sources) {
    if (!source.includes('defineDiagnostics(')) {
      continue
    }
    for (const [, code, why] of source.matchAll(CODE_WHY_RE)) {
      codes.set(code!, why!.trim())
    }
  }
  return codes
}

function git (...args: string[]) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
}

function hasRef (ref: string) {
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`)
    return true
  } catch {
    return false
  }
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

  it('sweeps every catalog defined in the repo', async () => {
    const files = await glob(CATALOG_GLOB, { cwd: packagesDir, absolute: true, ignore: ['**/node_modules/**'] })

    const defined = new Set<string>()
    for (const file of files) {
      const contents = readFileSync(file, 'utf-8')
      if (!contents.includes('defineDiagnostics(')) {
        continue
      }
      for (const match of contents.matchAll(/export const (\w+) =[\s\S]{0,120}?defineDiagnostics\(/g)) {
        defined.add(match[1]!)
      }
    }

    expect([...defined].filter(name => !(name in catalogs)).sort()).toStrictEqual([])
  })

  it('defines every `origin/4.x` code unless it is listed as 4.x-only', async (ctx) => {
    const ref = 'origin/4.x'
    if (!hasRef(ref)) {
      ctx.skip(`\`${ref}\` is not available; fetch it (for example \`git fetch origin 4.x\`) to compare catalogs across branches`)
    }

    const files = await glob(CATALOG_GLOB, { cwd: packagesDir, absolute: true, ignore: ['**/node_modules/**'] })
    const current = extractCodes(files.map(file => readFileSync(file, 'utf-8')))
    const other = extractCodes(git('grep', '-l', 'defineDiagnostics(', ref, '--', 'packages/*/src/**.ts').trim().split('\n').filter(Boolean).map(file => git('show', file)))

    expect(other.size).toBeGreaterThan(0)
    expect([...other.keys()].filter(code => !current.has(code) && !(code in FOURX_ONLY))).toStrictEqual([])
    expect(Object.keys(FOURX_ONLY).filter(code => !other.has(code) || current.has(code))).toStrictEqual([])
  })

  it('assigns every code shared with `origin/4.x` to the same diagnostic', async (ctx) => {
    const ref = 'origin/4.x'
    if (!hasRef(ref)) {
      ctx.skip(`\`${ref}\` is not available; fetch it (for example \`git fetch origin 4.x\`) to compare catalogs across branches`)
    }

    const files = await glob(CATALOG_GLOB, { cwd: packagesDir, absolute: true, ignore: ['**/node_modules/**'] })
    const current = extractCodes(files.map(file => readFileSync(file, 'utf-8')))

    const otherFiles = git('grep', '-l', 'defineDiagnostics(', ref, '--', 'packages/*/src/**.ts')
      .trim()
      .split('\n')
      .filter(Boolean)
    const other = extractCodes(otherFiles.map(file => git('show', file)))

    expect(current.size).toBeGreaterThan(0)
    expect(other.size).toBeGreaterThan(0)

    const mismatches = [...other]
      .filter(([code, why]) => current.has(code) && current.get(code) !== why)
      .map(([code, why]) => `${code}\n  ${ref}: ${why}\n  HEAD: ${current.get(code)}`)

    expect(mismatches).toStrictEqual([])
  })
})
