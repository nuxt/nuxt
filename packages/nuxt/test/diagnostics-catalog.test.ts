import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
  rendererDiagnostics,

  schemaDiagnostics,
}

const packagesDir = fileURLToPath(new URL('../..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

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

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'was', 'not', 'are', 'but', 'from', 'its', 'has', 'have', 'into', 'when', 'which', 'will', 'been', 'being', 'than', 'then', 'they', 'them', 'their', 'there', 'what', 'your', 'you', 'can', 'use', 'set'])
const PARAMS_RE = /^\([^)]*\)\s*=>/
const PLACEHOLDER_RE = /\$\{[^}]*\}/g
const WORD_RE = /[a-z][a-z0-9]{2,}/g

function words (why: string) {
  const text = why.replace(PARAMS_RE, ' ').replace(PLACEHOLDER_RE, ' ').toLowerCase()
  return new Set((text.match(WORD_RE) ?? []).filter(word => !STOP_WORDS.has(word)))
}

/**
 * The share of the shorter `why` whose words also appear in the other. A reworded diagnostic
 * keeps most of its vocabulary; an unrelated one sharing the code does not.
 */
function wordOverlap (a: string, b: string) {
  const left = words(a)
  const right = words(b)
  let shared = 0
  for (const word of left) {
    if (right.has(word)) {
      shared++
    }
  }
  return shared / Math.max(1, Math.min(left.size, right.size))
}

const MIN_WORD_OVERLAP = 1 / 3

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

  it('assigns every code shared with `origin/main` to the same diagnostic', async (ctx) => {
    const ref = 'origin/main'
    if (!hasRef(ref)) {
      ctx.skip(`\`${ref}\` is not available; fetch it (for example \`git fetch origin main\`) to compare catalogs across branches`)
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
      .filter(([code, why]) => current.has(code) && current.get(code) !== why && wordOverlap(current.get(code)!, why) < MIN_WORD_OVERLAP)
      .map(([code, why]) => `${code}\n  ${ref}: ${why}\n  HEAD: ${current.get(code)}`)

    expect(mismatches).toStrictEqual([])
  })

  it('tells a reworded diagnostic apart from a different one sharing its code', () => {
    const before = '(p: { minLength: number }) => `\\`runtimeConfig.appSecret\\` is unset or shorter than ${p.minLength} characters, so a random development secret is being used.`'
    const reworded = '\'A generated development secret is being used because `runtimeConfig.appSecret` is unset.\''
    const unrelated = '(p: { helper: string }) => `\\`${p.helper}\\` from \\`nuxt/server\\` was called with an h3 event.`'

    expect(wordOverlap(before, reworded)).toBeGreaterThanOrEqual(MIN_WORD_OVERLAP)
    expect(wordOverlap(before, unrelated)).toBeLessThan(MIN_WORD_OVERLAP)
  })
})
