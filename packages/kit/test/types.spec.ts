import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolveDeclarationPath, resolveTypePaths } from '../src/types.ts'

const fixtureDir = fileURLToPath(new URL('./types-fixture', import.meta.url))

describe('resolveDeclarationPath', () => {
  it('strips extensions in TypeScript\'s extensionless retry list', async () => {
    expect(await resolveDeclarationPath(`${fixtureDir}/util.ts`)).toBe(`${fixtureDir}/util`)
    expect(await resolveDeclarationPath(`${fixtureDir}/runtime.d.ts`)).toBe(`${fixtureDir}/runtime`)
  })

  it('preserves `.d.mts` / `.d.cts` declarations', async () => {
    expect(await resolveDeclarationPath(`${fixtureDir}/h3.d.mts`)).toBe(`${fixtureDir}/h3.d.mts`)
    expect(await resolveDeclarationPath(`${fixtureDir}/h3.d.cts`)).toBe(`${fixtureDir}/h3.d.cts`)
  })

  it('rewrites a runtime path to its declaration sibling when one exists', async () => {
    // `h3-runtime.mjs` has an adjacent `h3-runtime.d.mts`
    expect(await resolveDeclarationPath(`${fixtureDir}/h3-runtime.mjs`)).toBe(`${fixtureDir}/h3-runtime.d.mts`)
    // `runtime.mjs` has an adjacent `runtime.d.ts`, which TypeScript finds extensionless
    expect(await resolveDeclarationPath(`${fixtureDir}/runtime.mjs`)).toBe(`${fixtureDir}/runtime`)
  })

  it('returns the runtime path unchanged when no declaration sibling exists', async () => {
    expect(await resolveDeclarationPath(`${fixtureDir}/cache.mjs`)).toBe(`${fixtureDir}/cache.mjs`)
  })
})

describe('resolveTypePaths', () => {
  const root = mkdtempSync(join(tmpdir(), 'kit-type-paths-'))
  const dir = join(root, 'node_modules')

  function createPackage (name: string, files: Record<string, string>, pkg: Record<string, unknown>) {
    const pkgDir = join(dir, name)
    for (const [file, contents] of Object.entries(files)) {
      const filePath = join(pkgDir, file)
      mkdirSync(join(filePath, '..'), { recursive: true })
      writeFileSync(filePath, contents)
    }
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name, ...pkg }))
    return pkgDir
  }

  it('resolves a base package to its declaration entry via the `types` condition', async () => {
    const pkgDir = createPackage('typed-pkg', {
      'index.mjs': 'export const useThing = () => true\n',
      'dist/types.d.mts': 'export declare const useThing: () => boolean\n',
    }, {
      type: 'module',
      exports: {
        '.': {
          types: './dist/types.d.mts',
          import: './index.mjs',
        },
      },
    })

    const results = await resolveTypePaths(['typed-pkg'], [dir])
    expect(results).toEqual([['typed-pkg', join(pkgDir, 'dist/types.d.mts')]])
  })

  it('falls back to the package root when the root entry has no declaration', async () => {
    // mirrors `vue`, whose runtime entry has no sibling declaration and whose
    // `exports` map has no entry for the resolved file, so the type only resolves
    // through the package root
    const pkgDir = createPackage('untyped-root-pkg', {
      'index.mjs': 'export const useThing = () => true\n',
    }, {
      type: 'module',
      exports: {
        '.': {
          import: './index.mjs',
        },
      },
    })

    const results = await resolveTypePaths(['untyped-root-pkg'], [dir])
    expect(results).toEqual([['untyped-root-pkg', pkgDir]])
  })

  it('resolves a subpath export to its declaration sibling', async () => {
    const pkgDir = createPackage('subpath-pkg', {
      'dist/feature.mjs': 'export const useFeature = () => true\n',
      'dist/feature.d.mts': 'export declare const useFeature: () => boolean\n',
    }, {
      type: 'module',
      exports: {
        './feature': {
          types: './dist/feature.d.mts',
          import: './dist/feature.mjs',
        },
      },
    })

    const results = await resolveTypePaths(['subpath-pkg/feature'], [dir])
    expect(results).toEqual([['subpath-pkg/feature', join(pkgDir, 'dist/feature.d.mts')]])
  })

  it('resolves a scoped subpath export', async () => {
    const pkgDir = createPackage('@scope/pkg', {
      'dist/sub.mjs': 'export const useSub = () => true\n',
      'dist/sub.d.mts': 'export declare const useSub: () => boolean\n',
    }, {
      type: 'module',
      exports: {
        './sub': {
          types: './dist/sub.d.mts',
          import: './dist/sub.mjs',
        },
      },
    })

    const results = await resolveTypePaths(['@scope/pkg/sub'], [dir])
    expect(results).toEqual([['@scope/pkg/sub', join(pkgDir, 'dist/sub.d.mts')]])
  })

  it('omits packages that cannot be resolved', async () => {
    const results = await resolveTypePaths(['does-not-exist'], [dir])
    expect(results).toEqual([])
  })
})
