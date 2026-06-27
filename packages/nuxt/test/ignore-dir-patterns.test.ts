import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'
import { consola } from 'consola'
import { describe, expect, it, vi } from 'vitest'

import { normalizeDirs } from '../src/components/module.ts'
import { resolveIgnoreDirPatterns } from '../src/components/ignore-dir-patterns.ts'
import { scanComponents } from '../src/components/scan.ts'
import type { ComponentsDir, ComponentsOptions } from 'nuxt/schema'

vi.mock(import('@nuxt/kit'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isIgnored: () => false,
    useLogger: () => consola.create({}).withTag('nuxt'),
    useNuxt: () => ({ options: { rootDir: '/' } } as any),
    resolveAlias: (p: string) => p,
  }
})

const fixtureDir = fileURLToPath(new URL('components-fixture/ignore-dir-patterns', import.meta.url))
const rFixture = (...p: string[]) => resolve(fixtureDir, ...p)

const componentsRoot = rFixture('components')

const baseDir = (path: string, overrides: Partial<ComponentsDir> = {}): ComponentsDir => ({
  path,
  extensions: ['vue'],
  pattern: '**/*.{vue,}',
  ignore: [],
  transpile: false,
  ...overrides,
})

describe('resolveIgnoreDirPatterns', () => {
  it('returns null for falsy input', () => {
    expect(resolveIgnoreDirPatterns(undefined)).toBeNull()
    expect(resolveIgnoreDirPatterns(false)).toBeNull()
  })

  it('expands `true` to both patterns enabled', () => {
    expect(resolveIgnoreDirPatterns(true)).toEqual({ wrap: true, prefix: true })
  })

  it('honors per-pattern opt-in when passed an object', () => {
    expect(resolveIgnoreDirPatterns({ wrap: true })).toEqual({ wrap: true, prefix: false })
    expect(resolveIgnoreDirPatterns({ prefix: true })).toEqual({ wrap: false, prefix: true })
    expect(resolveIgnoreDirPatterns({ wrap: true, prefix: true })).toEqual({ wrap: true, prefix: true })
  })

  it('returns null when every pattern is disabled', () => {
    expect(resolveIgnoreDirPatterns({ wrap: false, prefix: false })).toBeNull()
    expect(resolveIgnoreDirPatterns({})).toBeNull()
  })
})

describe('normalizeDirs: ignoreDirPatterns propagation', () => {
  it('propagates `true` shorthand onto every produced dir entry', () => {
    const config: ComponentsOptions = {
      dirs: [componentsRoot],
      ignoreDirPatterns: true,
    }
    const dirs = normalizeDirs(config, fixtureDir)
    expect(dirs).toHaveLength(1)
    expect(dirs[0]!.ignoreDirPatterns).toEqual({ wrap: true, prefix: true })
  })

  it('propagates per-pattern object onto every produced dir entry', () => {
    const config: ComponentsOptions = {
      dirs: [componentsRoot],
      ignoreDirPatterns: { wrap: true },
    }
    const dirs = normalizeDirs(config, fixtureDir)
    expect(dirs[0]!.ignoreDirPatterns).toEqual({ wrap: true, prefix: false })
  })

  it('does not attach config when ignoreDirPatterns is unset', () => {
    const config: ComponentsOptions = { dirs: [componentsRoot] }
    const dirs = normalizeDirs(config, fixtureDir)
    expect(dirs[0]!.ignoreDirPatterns).toBeUndefined()
  })

  it('lets per-dir ignoreDirPatterns override the inherited one', () => {
    const config: ComponentsOptions = {
      dirs: [{ path: componentsRoot, ignoreDirPatterns: { prefix: true } }],
      ignoreDirPatterns: true,
    }
    const dirs = normalizeDirs(config, fixtureDir)
    expect(dirs[0]!.ignoreDirPatterns).toEqual({ prefix: true })
  })
})

describe('scanComponents: ignoreDirPatterns end-to-end', () => {
  it('strips matched folder segments from generated component names when fully enabled', async () => {
    const dir = baseDir(componentsRoot, { ignoreDirPatterns: { wrap: true, prefix: true } })
    const components = await scanComponents([dir], fixtureDir)
    const names = new Set(components.map(c => c.pascalName))
    // (auth)/forms/Login.vue -> FormsLogin (auth stripped, forms preserved)
    expect(names).toContain('FormsLogin')
    // _internal/widgets/Counter.vue -> WidgetsCounter (_internal stripped)
    expect(names).toContain('WidgetsCounter')
    // (apps)/(auth)/Nested.vue -> Nested (both stripped)
    expect(names).toContain('Nested')
    // regular/Plain.vue keeps its prefix
    expect(names).toContain('RegularPlain')
  })

  it('leaves names untouched when ignoreDirPatterns is not set', async () => {
    const dir = baseDir(componentsRoot)
    const components = await scanComponents([dir], fixtureDir)
    const names = new Set(components.map(c => c.pascalName))
    expect(names).not.toContain('FormsLogin')
    expect(names).not.toContain('WidgetsCounter')
    expect(names).toContain('RegularPlain')
  })

  it('`wrap: true` alone strips parenthesized folders but not underscore-prefixed ones', async () => {
    const dir = baseDir(componentsRoot, { ignoreDirPatterns: { wrap: true } })
    const components = await scanComponents([dir], fixtureDir)
    const names = new Set(components.map(c => c.pascalName))
    expect(names).toContain('FormsLogin') // (auth) stripped
    // _internal is NOT stripped — name still includes the underscore-derived segment.
    expect(names).not.toContain('WidgetsCounter')
  })

  it('`prefix: true` alone strips underscore-prefixed folders but not parenthesized ones', async () => {
    const dir = baseDir(componentsRoot, { ignoreDirPatterns: { prefix: true } })
    const components = await scanComponents([dir], fixtureDir)
    const names = new Set(components.map(c => c.pascalName))
    expect(names).toContain('WidgetsCounter') // _internal stripped
    // (auth) is NOT stripped — the parens may render oddly in splitByCase but
    // the key assertion is that the segment is not silently removed.
    expect(names).not.toContain('FormsLogin')
  })

  // Modeled after `scan-components.test.ts` — a full deep-equal assertion of
  // scanned component metadata, to verify the shape end-to-end.
  it('matches a full component snapshot when stripping `(auth)`', async () => {
    const dir = baseDir(rFixture('components/(auth)'), {
      ignoreDirPatterns: { wrap: true },
    })
    const components = await scanComponents([dir], fixtureDir)
    for (const c of components) {
      // @ts-expect-error filePath is present at runtime but excluded from the snapshot
      delete c.filePath
      // @ts-expect-error internal _scanned flag
      delete c._scanned
    }
    expect(components).deep.eq([
      {
        mode: 'all',
        pascalName: 'FormsLogin',
        kebabName: 'forms-login',
        chunkName: 'components/forms-login',
        declarationPath: rFixture('components/(auth)/forms/Login.vue'),
        shortPath: 'components/(auth)/forms/Login.vue',
        export: 'default',
        global: undefined,
        island: undefined,
        prefetch: false,
        preload: false,
        priority: 1,
      },
    ])
  })
})
