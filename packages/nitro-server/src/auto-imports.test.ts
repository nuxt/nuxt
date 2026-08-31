import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { dirname, isAbsolute, join, resolve } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import { createServerAutoImports } from './auto-imports.ts'
import { getH3ImportsPreset, v2ImportsPreset } from './imports.ts'

const TYPE_EXTENSIONS = ['.d.ts', '.d.mts', '.d.cts', '.ts', '.mts', '.js', '.mjs']

function mockNuxt (): Nuxt {
  return {
    options: {
      rootDir: '/app',
      srcDir: '/app',
      ignore: [],
      imports: { scan: false },
      _layers: [],
    },
  } as unknown as Nuxt
}

describe('createServerAutoImports', () => {
  it('names package subpaths as written rather than as a path on disk', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: true, presets: [...v2ImportsPreset, await getH3ImportsPreset()] },
      typesDir,
    )

    await autoImports.writeTypes()

    const contents = readFileSync(autoImports.importsModulePath + '.d.ts', 'utf8')
    const referenced = [...new Set([...contents.matchAll(/import\('([^']+)'\)/g)].map(m => m[1]!))]
    expect(referenced.length).toBeGreaterThan(0)

    expect(referenced.filter(s => s.includes('node_modules'))).toEqual([])
    expect(referenced).toContain('nitro/h3')
    expect(referenced).toContain('nitro/cache')
  })

  it('resolves a local type path to a declaration TypeScript can follow', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: true, imports: [{ name: 'withBaseURL', from: resolve(import.meta.dirname, 'runtime/utils/base.ts') }] },
      typesDir,
    )

    await autoImports.writeTypes()

    const declarationPath = autoImports.importsModulePath + '.d.ts'
    const contents = readFileSync(declarationPath, 'utf8')
    const referenced = [...new Set([...contents.matchAll(/import\('([^']+)'\)/g)].map(m => m[1]!))]

    expect(referenced).toHaveLength(1)
    expect(referenced[0]).toMatch(/^\.\.?\//)
    const target = resolve(dirname(declarationPath), referenced[0]!)
    expect(TYPE_EXTENSIONS.some(ext => existsSync(target + ext))).toBe(true)
  })

  it('emits a module even when there are no imports to declare', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(mockNuxt(), { autoImport: true }, typesDir)

    await autoImports.writeTypes()

    expect(readFileSync(autoImports.importsModulePath + '.d.ts', 'utf8')).toContain('export {}')
    expect(readFileSync(autoImports.importsModulePath + '.mjs', 'utf8')).toContain('export {}')
  })

  it('injects an import for an identifier used in a TypeScript-only expression', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: true, presets: [{ from: 'nitro/h3', imports: ['defineEventHandler'] }] },
      typesDir,
    )

    const code = `export default defineEventHandler(() => ({ a: 1 }) as { a: number } | { b: string })`
    const result = await autoImports.injectImports(code, '/app/server/api/union.ts')

    expect(result?.s.hasChanged()).toBe(true)
    expect(result!.s.toString()).toContain('defineEventHandler')
    expect(result!.s.toString()).toMatch(/^import /m)
  })

  it('does not inject an import for a name a local binding shadows', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: true, imports: [{ name: 'defineEventHandler', from: 'nitro/h3' }] },
      typesDir,
    )

    for (const code of [
      'export function f (defineEventHandler) { return defineEventHandler }',
      'export function f () { const defineEventHandler = 1; return defineEventHandler }',
    ]) {
      const result = await autoImports.injectImports(code, '/app/server/utils/shadow.ts')
      expect(result?.s.hasChanged()).toBe(false)
    }
  })

  it('resolves `#imports` to a path inside the types directory', () => {
    const typesDir = '/app/.nuxt'
    const autoImports = createServerAutoImports(mockNuxt(), { autoImport: true }, typesDir)

    expect(isAbsolute(autoImports.importsModulePath)).toBe(true)
    expect(autoImports.importsModulePath.startsWith(typesDir)).toBe(true)
  })
})
