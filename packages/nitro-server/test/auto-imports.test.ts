import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import { dirname, isAbsolute, join, resolve } from 'pathe'
import { rolldown } from 'rolldown'
import type { Nuxt } from '@nuxt/schema'
import { createServerAutoImports, resolveNestedServerUtilsDirs, resolveServerImportDirs } from '../src/auto-imports.ts'
import { ServerAutoImportsPlugin, serverImportSourcesPlugin, serverImportsModulePlugin } from '../src/auto-imports-plugin.ts'
import { getServerImportsPresets, resolveNitroLegacyOptions } from '../src/compat.ts'
import { nitroBuildDiagnostics } from '../src/diagnostics.ts'
import { getH3ImportsPreset, nuxtServerImportsPreset, v2ImportsPreset } from '../src/imports.ts'
import { getLayerNodeModulesExcludePattern } from '../src/utils.ts'

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

function createNestedUtilsFixture (): Nuxt {
  const rootDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-nested-'))
  const layerDir = join(rootDir, 'layer')
  const files: Record<string, string> = {
    'server/utils/top.ts': 'export const useTopLevelUtil = () => {}',
    'server/utils/admin/oauth.ts': 'export const requireAdminSession = () => {}\nexport interface AdminSession {}',
    'layer/server/utils/deeply/nested/util.ts': 'export const useLayerNestedUtil = () => {}',
    'server/types/nested/type.ts': 'export interface NestedServerType {}',
    'shared/utils/nested/util.ts': 'export const useNestedSharedUtil = () => {}',
    'shared/types/nested/type.ts': 'export interface NestedSharedType {}',
  }
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true })
    writeFileSync(join(rootDir, path), contents + '\n')
  }
  const nuxt = mockNuxt()
  nuxt.options.rootDir = rootDir
  nuxt.options.srcDir = rootDir
  nuxt.options.imports = {} as Nuxt['options']['imports']
  nuxt.options._layers = [{ cwd: rootDir, config: { rootDir } }, { cwd: layerDir, config: { rootDir: layerDir } }] as unknown as Nuxt['options']['_layers']
  return nuxt
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

  it('auto-imports the portable server surface rather than the runtime it delegates to', async () => {
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: true, presets: [nuxtServerImportsPreset, ...v2ImportsPreset, await getH3ImportsPreset()] },
      mkdtempSync(join(tmpdir(), 'server-auto-imports-')),
    )

    const imports = await autoImports.getImports()
    const sourceOf = (name: string) => imports.filter(i => (i.as ?? i.name) === name).map(i => i.from)

    for (const name of ['defineHandler', 'defineEventHandler', 'createError', 'getQuery', 'readBody', 'getCookie', 'useRuntimeConfig', 'getRouteRules', 'readValidatedBody', 'getRouterParam', 'handleCors']) {
      expect(sourceOf(name), name).toEqual(['nuxt/server'])
    }

    expect(sourceOf('readRawBody')).toEqual(['nitro/h3'])
  })

  it('resolves a local type path to a declaration TypeScript can follow', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: true, imports: [{ name: 'withBaseURL', from: resolve(import.meta.dirname, '../src/runtime/utils/base.ts') }] },
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

  it('declares an import from the module its types are read from', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: true, presets: await getServerImportsPresets(resolveNitroLegacyOptions(true)) },
      typesDir,
    )

    await autoImports.writeTypes()

    const declarations = readFileSync(autoImports.importsModulePath + '.d.ts', 'utf8')
    expect(declarations).toContain('const useAppConfig: typeof import(\'nuxt/server\').useAppConfig')
    expect(declarations).toMatch(/^export \{[^}]*\buseAppConfig\b[^}]*\} from 'nuxt\/server';$/m)
  })

  it('emits a module even when there are no imports to declare', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(mockNuxt(), { autoImport: true }, typesDir)

    await autoImports.writeTypes()

    expect(readFileSync(autoImports.importsModulePath + '.d.ts', 'utf8')).toContain('export {}')
    expect(readFileSync(autoImports.importsModulePath + '.mjs', 'utf8')).toContain('export {}')
  })

  it('serves `#imports/server` and `#imports` without the generated module on disk', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const util = join(typesDir, 'util.ts')
    writeFileSync(util, 'export const useThing = () => \'from-util\'\n')
    const autoImports = createServerAutoImports(mockNuxt(), { autoImport: true, imports: [{ name: 'useThing', from: util }] }, typesDir)

    const build = await rolldown({ input: ['#imports/server', '#imports'], plugins: [serverImportsModulePlugin(autoImports)] })
    try {
      const { output } = await build.generate({ format: 'esm' })
      expect(output.map(o => o.type === 'chunk' ? o.code : '').join('\n')).toContain('from-util')
    } finally {
      await build.close()
    }
    expect(existsSync(autoImports.importsModulePath + '.mjs')).toBe(false)
  })

  it('still re-exports registered imports when auto-importing is disabled', async () => {
    const typesDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-'))
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: false, imports: [{ name: 'withBaseURL', from: resolve(import.meta.dirname, '../src/runtime/utils/base.ts') }] },
      typesDir,
    )

    await autoImports.writeTypes()

    const module = readFileSync(autoImports.importsModulePath + '.mjs', 'utf8')
    const declarations = readFileSync(autoImports.importsModulePath + '.d.ts', 'utf8')
    expect(module).toContain('export { withBaseURL }')
    expect(declarations).toContain('export { withBaseURL }')
    expect(declarations).not.toContain('declare global')

    const injected = await autoImports.injectImports('export default withBaseURL("/")', '/app/server/api/index.ts')
    expect(injected).toBeUndefined()
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

  it('prefers a project server util over one from an extended layer', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-layers-'))
    const layerDir = join(rootDir, 'layer')
    for (const [dir, value] of [[rootDir, 'root'], [layerDir, 'layer']] as const) {
      mkdirSync(join(dir, 'server/utils'), { recursive: true })
      writeFileSync(join(dir, 'server/utils/useMyServerUtil.ts'), `export const useMyServerUtil = () => '${value}'\n`)
    }
    const nuxt = mockNuxt()
    nuxt.options.rootDir = rootDir
    nuxt.options.srcDir = rootDir
    nuxt.options._layers = [{ cwd: rootDir, config: { rootDir } }, { cwd: layerDir, config: { rootDir: layerDir } }] as unknown as Nuxt['options']['_layers']

    const autoImports = createServerAutoImports(
      nuxt,
      { autoImport: true, dirs: [join(rootDir, 'server/utils'), join(layerDir, 'server/utils')] },
      mkdtempSync(join(tmpdir(), 'server-auto-imports-')),
    )

    const imports = await autoImports.getImports()
    expect(imports.filter(i => i.name === 'useMyServerUtil').map(i => i.from)).toEqual([join(rootDir, 'server/utils/useMyServerUtil.ts')])
  })

  it('only auto-imports server utils directly in `server/utils/` by default', async () => {
    const nuxt = createNestedUtilsFixture()

    const autoImports = createServerAutoImports(
      nuxt,
      { autoImport: true, dirs: resolveServerImportDirs(nuxt) },
      mkdtempSync(join(tmpdir(), 'server-auto-imports-')),
    )

    const imports = await autoImports.getImports()
    expect(imports.map(i => i.name)).toEqual(['useTopLevelUtil'])
  })

  it('auto-imports server utils nested in subdirectories of each layer with `nestedUtils`', async () => {
    const nuxt = createNestedUtilsFixture()

    const autoImports = createServerAutoImports(
      nuxt,
      { autoImport: true, dirs: resolveServerImportDirs(nuxt, { nestedUtils: true }) },
      mkdtempSync(join(tmpdir(), 'server-auto-imports-')),
    )

    const imports = await autoImports.getImports()
    expect(imports.map(i => i.name).sort()).toEqual(['AdminSession', 'requireAdminSession', 'useLayerNestedUtil', 'useTopLevelUtil'])

    await autoImports.writeTypes()
    const declarations = readFileSync(autoImports.importsModulePath + '.d.ts', 'utf8')
    expect(declarations).toContain('const requireAdminSession: typeof import(')
    expect(declarations).toContain('const useLayerNestedUtil: typeof import(')
  })

  it('warns once when a nested server util is used without an import', async () => {
    const nuxt = createNestedUtilsFixture()
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9006').mockImplementation(() => ({}) as any)

    const autoImports = createServerAutoImports(
      nuxt,
      { autoImport: true, dirs: resolveServerImportDirs(nuxt) },
      mkdtempSync(join(tmpdir(), 'server-auto-imports-')),
      { nestedUtilsDirs: resolveNestedServerUtilsDirs(nuxt) },
    )

    const handler = join(nuxt.options.rootDir, 'server/api/admin.ts')
    const code = 'export default (): AdminSession => [requireAdminSession(), useTopLevelUtil()]'
    await autoImports.injectImports(code, handler)
    await autoImports.injectImports(code, handler)
    await autoImports.injectImports(`import { requireAdminSession } from '../utils/admin/oauth'\n${code}`, join(nuxt.options.rootDir, 'server/api/imported.ts'))
    await autoImports.injectImports('export default (useLayerNestedUtil: () => void) => useLayerNestedUtil()', join(nuxt.options.rootDir, 'server/api/shadowed.ts'))

    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith({
      file: 'server/api/admin.ts',
      count: 1,
      names: '`requireAdminSession` (from `server/utils/admin/oauth.ts`)',
    })
    report.mockRestore()
  })

  it('reports server utilities used without an import while their presets are disabled', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9007').mockImplementation(() => ({}) as any)
    const autoImports = createServerAutoImports(
      mockNuxt(),
      { autoImport: true, imports: [{ name: 'useLocal', from: '/app/server/utils/local.ts' }] },
      mkdtempSync(join(tmpdir(), 'server-auto-imports-')),
      { disabledPresets: [nuxtServerImportsPreset, ...v2ImportsPreset] },
    )

    const cached = 'export const fetchPackage = defineCachedFunction(() => useLocal())'
    await autoImports.injectImports(cached, '/app/server/utils/npm.ts')
    await autoImports.injectImports(cached, '/app/server/utils/npm.ts')
    await autoImports.injectImports('export default defineEventHandler(event => getQuery(event))', '/app/server/api/query.ts')
    await autoImports.injectImports('import { defineEventHandler } from \'nuxt/server\'\nexport default defineEventHandler(() => 1)', '/app/server/api/imported.ts')
    await autoImports.injectImports('export default defineNitroPlugin(() => {})', '/app/server/plugins/setup.ts')

    await vi.waitFor(() => expect(report).toHaveBeenCalled())
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith({
      count: 3,
      files: '`server/api/query.ts` (`defineEventHandler`, `getQuery`)\n  - `server/plugins/setup.ts` (`defineNitroPlugin`)\n  - `server/utils/npm.ts` (`defineCachedFunction`)',
      imports: '`import { defineEventHandler, getQuery } from \'nuxt/server\'`, `import { definePlugin as defineNitroPlugin } from \'nitro\'`, `import { defineCachedFunction } from \'nitro/cache\'`',
    })
    report.mockRestore()
  })

  it.each([
    ['without', []],
    ['with', [nuxtServerImportsPreset, ...v2ImportsPreset]],
  ])('reports server code relying on a global `$fetch` %s disabled presets', async (_, disabledPresets) => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9011').mockImplementation(() => ({}) as any)
    const presetReport = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9007').mockImplementation(() => ({}) as any)
    const autoImports = createServerAutoImports(mockNuxt(), { autoImport: true }, mkdtempSync(join(tmpdir(), 'server-auto-imports-')), { disabledPresets })

    const handler = 'export default () => $fetch(\'/api/probe\')'
    await autoImports.injectImports(handler, '/app/server/api/proxy.ts')
    await autoImports.injectImports(handler, '/app/server/api/proxy.ts')
    await autoImports.injectImports('export const load = () => $fetch(\'https://example.com\')', '/app/server/utils/load.ts')
    await autoImports.injectImports('import { $fetch } from \'ofetch\'\nexport default () => $fetch(\'/\')', '/app/server/api/imported.ts')
    await autoImports.injectImports('export default (app) => app.$fetch(\'/\')', '/app/server/api/property.ts')
    await autoImports.injectImports('import { defineHandler } from \'nitro/h3\'\nexport default defineHandler(event => $fetch(\'/api/probe\', { query: getQuery(event) }))', '/app/server/api/query.ts')

    await vi.waitFor(() => expect(report).toHaveBeenCalled())
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith({
      count: 3,
      files: '`server/api/proxy.ts`\n  - `server/api/query.ts`\n  - `server/utils/load.ts`',
    })
    if (disabledPresets.length) {
      await vi.waitFor(() => expect(presetReport).toHaveBeenCalled())
      expect(presetReport).toHaveBeenCalledWith(expect.objectContaining({ count: 1, files: '`server/api/query.ts` (`getQuery`)' }))
    } else {
      expect(presetReport).not.toHaveBeenCalled()
    }
    report.mockRestore()
    presetReport.mockRestore()
  })

  it.each([
    ['with a runtime entry', { '.': { types: './index.d.mts', default: './index.mjs' } }],
    ['that only declares types', { '.': { types: './index.d.mts' } }],
  ])('types a registered import from the module directory that can resolve its `typeFrom`, a package %s', async (_, exports) => {
    const rootDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-module-types-'))
    const files: Record<string, string> = {
      'module/node_modules/module-types/package.json': JSON.stringify({ name: 'module-types', type: 'module', exports }),
      ...'default' in exports['.'] && { 'module/node_modules/module-types/index.mjs': '' },
      'module/node_modules/module-types/index.d.mts': 'export declare const useTyped: () => \'typed\'',
      'node_modules/root-dep/package.json': JSON.stringify({ name: 'root-dep', type: 'module', exports: './index.mjs' }),
      'node_modules/root-dep/index.mjs': 'export const useTyped = () => \'typed\'',
    }
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(rootDir, path)), { recursive: true })
      writeFileSync(join(rootDir, path), contents + '\n')
    }
    const nuxt = mockNuxt()
    nuxt.options.rootDir = rootDir
    nuxt.options.modulesDir = [join(rootDir, 'node_modules'), join(rootDir, 'module/node_modules')]
    const autoImports = createServerAutoImports(
      nuxt,
      { autoImport: true, imports: [{ name: 'useTyped', from: 'root-dep', typeFrom: 'module-types' }] },
      join(rootDir, '.nuxt'),
    )

    await autoImports.writeTypes()

    expect(readFileSync(autoImports.importsModulePath + '.d.ts', 'utf8')).toContain('typeof import(\'#internal/server-imports/module-types\')')
    expect(await autoImports.getSourceTypePaths()).toEqual({ '#internal/server-imports/module-types': [join(rootDir, 'module/node_modules/module-types/index.d.mts')] })
  })

  it('resolves a registered bare import from the module directory that can resolve it', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'server-auto-imports-module-dep-'))
    const files: Record<string, string> = {
      'module/node_modules/module-only-dep/package.json': JSON.stringify({ name: 'module-only-dep', type: 'module', exports: { '.': { types: './index.d.mts', default: './index.mjs' } } }),
      'module/node_modules/module-only-dep/index.mjs': 'export const useModuleOnlyDep = () => \'from-module-dep\'',
      'module/node_modules/module-only-dep/index.d.mts': 'export declare const useModuleOnlyDep: () => \'from-module-dep\'',
      'node_modules/root-dep/package.json': JSON.stringify({ name: 'root-dep', type: 'module', exports: './index.mjs' }),
      'node_modules/root-dep/index.mjs': 'export const useRootDep = () => \'from-root-dep\'',
      'server/api/injected.ts': 'export default () => [useModuleOnlyDep(), useRootDep()]',
    }
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(rootDir, path)), { recursive: true })
      writeFileSync(join(rootDir, path), contents + '\n')
    }
    const nuxt = mockNuxt()
    nuxt.options.rootDir = rootDir
    nuxt.options.modulesDir = [join(rootDir, 'node_modules'), join(rootDir, 'module/node_modules')]
    const autoImports = createServerAutoImports(
      nuxt,
      { autoImport: true, imports: [{ name: 'useModuleOnlyDep', from: 'module-only-dep' }, { name: 'useRootDep', from: 'root-dep' }] },
      join(rootDir, '.nuxt'),
    )

    await autoImports.writeTypes()

    expect(await autoImports.renderModule()).toContain('export { useModuleOnlyDep } from \'module-only-dep\'')
    const declarations = readFileSync(autoImports.importsModulePath + '.d.ts', 'utf8')
    expect(declarations).toContain('typeof import(\'#internal/server-imports/module-only-dep\')')
    expect(declarations).toContain('export { useModuleOnlyDep } from \'#internal/server-imports/module-only-dep\'')
    expect(declarations).toContain('typeof import(\'root-dep\')')
    expect(await autoImports.getSourceTypePaths()).toEqual({ '#internal/server-imports/module-only-dep': [join(rootDir, 'module/node_modules/module-only-dep/index.d.mts')] })

    const build = await rolldown({
      input: ['#imports/server', join(rootDir, 'server/api/injected.ts')],
      plugins: [
        serverImportsModulePlugin(autoImports),
        ServerAutoImportsPlugin.rolldown({ autoImports, buildDir: join(rootDir, '.nuxt'), exclude: [] }),
        serverImportSourcesPlugin(autoImports),
      ],
    })
    try {
      const { output } = await build.generate({ format: 'esm' })
      const chunks = output.filter(o => o.type === 'chunk')
      const fileNames = new Set(output.map(o => o.fileName))
      expect(chunks.flatMap(chunk => chunk.imports).filter(id => !fileNames.has(id))).toEqual([])
      expect(chunks.map(chunk => chunk.code).join('\n')).toContain('from-module-dep')
    } finally {
      await build.close()
    }
  })

  it('resolves `#imports` to a path inside the types directory', () => {
    const typesDir = '/app/.nuxt'
    const autoImports = createServerAutoImports(mockNuxt(), { autoImport: true }, typesDir)

    expect(isAbsolute(autoImports.importsModulePath)).toBe(true)
    expect(autoImports.importsModulePath.startsWith(typesDir)).toBe(true)
  })
})

describe('ServerAutoImportsPlugin', () => {
  const createPlugin = (layerRoots: string[]) => ServerAutoImportsPlugin.raw({
    autoImports: createServerAutoImports(mockNuxt(), { autoImport: true }, '/app/.nuxt'),
    buildDir: '/app/.nuxt',
    exclude: [getLayerNodeModulesExcludePattern(layerRoots)],
  }, {} as any) as { transformInclude: (id: string) => boolean }

  it('does not transform bundled environment outputs', () => {
    const plugin = createPlugin(['/app/'])

    expect(plugin.transformInclude('/app/server/api/hello.ts')).toBe(true)
    expect(plugin.transformInclude('/app/.nuxt/vite/services-utils.ts')).toBe(true)
    expect(plugin.transformInclude('/app/.nuxt/vite/services/ssr/index.mjs')).toBe(false)
    expect(plugin.transformInclude('/app/.nuxt/dist/server/server.mjs')).toBe(false)
    expect(plugin.transformInclude('/app/.nuxt/dist/server/_nuxt/chunk.mjs')).toBe(false)
    expect(plugin.transformInclude('/app/node_modules/pkg/index.mjs')).toBe(false)
  })

  it('transforms the server code of a layer installed in node_modules', () => {
    const plugin = createPlugin(['/app/', '/app/node_modules/.pnpm/layer@1.0.0/node_modules/layer/'])

    expect(plugin.transformInclude('/app/node_modules/.pnpm/layer@1.0.0/node_modules/layer/server/api/hello.get.ts')).toBe(true)
    expect(plugin.transformInclude('/app/node_modules/.pnpm/layer@1.0.0/node_modules/layer/server/utils/hello.ts')).toBe(true)
    expect(plugin.transformInclude('/app/node_modules/.pnpm/pkg@1.0.0/node_modules/pkg/index.mjs')).toBe(false)
  })
})
