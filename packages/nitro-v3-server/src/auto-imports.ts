import { mkdir, writeFile } from 'node:fs/promises'
import { createIsIgnored, directoryToURL, resolveTypePaths as resolvePackageTypePaths } from '@nuxt/kit'
import { isWithinDir } from '@nuxt/kit/internal'
import { resolveModulePath } from 'exsolve'
import { dirname, isAbsolute, join, relative } from 'pathe'
import { createUnimport, scanDirExports, toExports } from 'unimport'
import type { Import, InjectImportsOptions, InlinePreset, Unimport } from 'unimport'
import type { Nuxt, ServerImportsOptions } from '@nuxt/schema'
import { nitroBuildDiagnostics } from './diagnostics.ts'

export interface ServerAutoImports {
  /** Inject auto-imports into a server module, or `undefined` when auto-imports are disabled. */
  injectImports: (code: string, id: string, options?: InjectImportsOptions) => Promise<Awaited<ReturnType<Unimport['injectImports']>> | undefined>
  /** Rescan the auto-import directories and regenerate declarations. */
  refresh: () => Promise<void>
  /** The full set of auto-imports available in the server program. */
  getImports: () => Promise<Import[]>
  /** Write `#imports` and the type declarations for the server program. */
  writeTypes: () => Promise<void>
  /** Render the module `#imports/server` resolves to. */
  renderModule: () => Promise<string>
  /**
   * The directory a bare import source is resolved from, for a registered source that the
   * project root cannot resolve but one of `modulesDir` can.
   */
  resolveSourceDir: (source: string) => Promise<string | undefined>
  /** `paths` substitutions for the sources `resolveSourceDir` resolves, keyed as the declarations name them. */
  getSourceTypePaths: () => Promise<Record<string, [string]>>
  /** Path of the generated module `#imports/server` resolves to in the server program. */
  importsModulePath: string
  /** Whether auto-imports are enabled at all. */
  enabled: boolean
}

export interface ServerAutoImportsContext {
  /** Directories whose exports are not auto-imported, but are reported when used without an import. */
  nestedUtilsDirs?: string[]
  /** Presets that are not auto-imported, but are reported when used without an import. */
  disabledPresets?: InlinePreset[]
}

const MAX_REPORTED_FILES = 10
const DOLLAR_FETCH_RE = /(?<![\w$.])\$fetch\b/
const BARE_SPECIFIER_RE = /^(?:@[\w.-]+\/)?\w[\w.-]*(?:\/|$)/
const SOURCE_RESOLVE_CONDITIONS = ['node', 'import', 'require']
const TYPE_SOURCE_RESOLVE_CONDITIONS = ['types', ...SOURCE_RESOLVE_CONDITIONS]
const SOURCE_TYPES_PREFIX = '#internal/server-imports/'
const GLOBAL_FETCH_IMPORT: Import = { name: '$fetch', from: 'ofetch' }

/** Creates and applies the auto-imports available to the modules the server builder bundles. */
export function createServerAutoImports (nuxt: Nuxt, options: ServerImportsOptions, typesDir: string, context: ServerAutoImportsContext = {}): ServerAutoImports {
  const enabled = options.autoImport !== false
  const importsModulePath = join(typesDir, 'types/server-imports')
  // substitutions are resolved relative to the generated file itself, not to `typesDir`
  const importsModuleDir = dirname(importsModulePath)

  const ctx: Unimport = createUnimport({
    parser: 'oxc',
    injectAtEnd: true,
    presets: options.presets ?? [],
    imports: options.imports ?? [],
    addons: { addons: [] },
  })

  const isIgnored = createIsIgnored(nuxt)
  const scanDirs = options.dirs ?? []
  const nestedUtilsDirs = enabled ? context.nestedUtilsDirs ?? [] : []
  const nestedUtilsCtx = nestedUtilsDirs.length > 0
    ? createUnimport({ parser: 'oxc', presets: [], imports: [], addons: { addons: [] } })
    : undefined
  const reportedNestedUtils = new Set<string>()
  const disabledPresets = enabled ? context.disabledPresets ?? [] : []
  const disabledPresetsCtx = disabledPresets.length > 0
    ? createUnimport({ parser: 'oxc', presets: disabledPresets, imports: [GLOBAL_FETCH_IMPORT], addons: { addons: [] } })
    : undefined
  const reportedPresetFiles = new Set<string>()
  const pendingPresetReports = new Map<string, Import[]>()
  let presetReportTimer: ReturnType<typeof setTimeout> | undefined
  const globalFetchCtx = disabledPresetsCtx
    ? undefined
    : createUnimport({ parser: 'oxc', presets: [], imports: [GLOBAL_FETCH_IMPORT], addons: { addons: [] } })
  const reportedGlobalFetch = new Set<string>()
  const pendingGlobalFetch = new Set<string>()
  let globalFetchTimer: ReturnType<typeof setTimeout> | undefined

  // the project comes first in `_layers`, so it gets the highest priority; the floor of 1 is
  // unimport's default, so a scanned util still takes precedence over a preset of the same name
  const layerPriorities = nuxt.options._layers
    .map((layer, i) => [layer.config.rootDir, nuxt.options._layers.length - i] as const)
    .sort(([a], [b]) => b.length - a.length)

  let sourceDirs: Promise<Map<string, string>> | undefined
  function resolveSourceDirs () {
    sourceDirs ??= init().then(async () => {
      const dirs = new Map<string, string>()
      const searchDirs = [nuxt.options.rootDir, ...nuxt.options.modulesDir ?? []]
      const sources = (await ctx.getImports()).flatMap((i): Array<[string, string[]]> => [[i.from, SOURCE_RESOLVE_CONDITIONS], ...i.typeFrom ? [[i.typeFrom, TYPE_SOURCE_RESOLVE_CONDITIONS] as [string, string[]]] : []])
      for (const [source, conditions] of sources) {
        if (dirs.has(source) || !BARE_SPECIFIER_RE.test(source)) { continue }
        const dir = searchDirs.find(dir => resolveModulePath(source, { from: directoryToURL(dir), conditions, try: true }))
        if (dir && dir !== nuxt.options.rootDir) {
          dirs.set(source, dir)
        }
      }
      return dirs
    })
    return sourceDirs
  }

  function renderModule (imports: Import[]) {
    return (toExports(imports, importsModuleDir).trim() || 'export {}') + '\n'
  }

  let initialised: Promise<void> | undefined
  function init () {
    initialised ??= (async () => {
      await ctx.init()
      await scan()
    })()
    return initialised
  }

  async function scan () {
    if (nestedUtilsCtx) {
      await nestedUtilsCtx.modifyDynamicImports(async () => {
        const scanned = await scanDirExports(nestedUtilsDirs, { fileFilter: file => !isIgnored(file) })
        return scanned.filter(i => !i.type)
      })
    }
    if (scanDirs.length === 0) { return }
    await ctx.modifyDynamicImports(async (imports) => {
      const scanned = await scanDirExports(scanDirs, {
        fileFilter: file => !isIgnored(file),
      })
      for (const i of scanned) {
        i.priority ??= layerPriorities.find(([dir]) => isWithinDir(i.from, dir))?.[1]
      }
      imports.push(...scanned)
      return imports
    })
  }

  async function reportNestedUtils (code: string, id: string) {
    if (!nestedUtilsCtx || (await nestedUtilsCtx.getImports()).length === 0) { return }
    const { imports } = await nestedUtilsCtx.injectImports(code, id, { autoImport: true, id } as InjectImportsOptions)
    if (imports.length === 0) { return }
    const names = imports.map(i => `\`${i.as ?? i.name}\` (from \`${relative(nuxt.options.rootDir, i.from)}\`)`).sort()
    const key = id + '\0' + names.join('\0')
    if (reportedNestedUtils.has(key)) { return }
    reportedNestedUtils.add(key)
    nitroBuildDiagnostics.NUXT_B9006({ file: relative(nuxt.options.rootDir, id), count: names.length, names: names.join(', ') })
  }

  async function reportDisabledPresets (code: string, id: string) {
    if (!disabledPresetsCtx) { return }
    const { imports: detected } = await disabledPresetsCtx.injectImports(code, id, { autoImport: true, id } as InjectImportsOptions)
    const imports = detected.filter(i => i.name !== GLOBAL_FETCH_IMPORT.name || i.from !== GLOBAL_FETCH_IMPORT.from)
    if (imports.length < detected.length) {
      queueGlobalFetchReport(id)
    }
    if (imports.length === 0) { return }
    const key = id + '\0' + imports.map(i => i.as ?? i.name).sort().join('\0')
    if (reportedPresetFiles.has(key)) { return }
    reportedPresetFiles.add(key)
    pendingPresetReports.set(id, imports)
    // files are transformed one at a time, so the report waits for the rest of the batch
    clearTimeout(presetReportTimer)
    presetReportTimer = setTimeout(flushDisabledPresetReports, 100)
  }

  function flushDisabledPresetReports () {
    const reports = [...pendingPresetReports].sort(([a], [b]) => a.localeCompare(b))
    pendingPresetReports.clear()
    const bySource = new Map<string, Set<string>>()
    for (const [, imports] of reports) {
      for (const i of imports) {
        const names = bySource.get(i.from) || new Set()
        bySource.set(i.from, names)
        names.add(i.as && i.as !== i.name ? `${i.name} as ${i.as}` : i.name)
      }
    }
    const files = reports.slice(0, MAX_REPORTED_FILES).map(([id, imports]) => `\`${relative(nuxt.options.rootDir, id)}\` (${imports.map(i => `\`${i.as ?? i.name}\``).sort().join(', ')})`)
    if (reports.length > MAX_REPORTED_FILES) {
      files.push(`and ${reports.length - MAX_REPORTED_FILES} more`)
    }
    nitroBuildDiagnostics.NUXT_B9007({
      count: reports.length,
      files: files.join('\n  - '),
      imports: [...bySource].map(([from, names]) => `\`import { ${[...names].sort().join(', ')} } from '${from}'\``).join(', '),
    })
  }

  // TODO: remove in Nuxt 6, with `NUXT_B9011`
  async function reportGlobalFetch (code: string, id: string) {
    if (!globalFetchCtx || reportedGlobalFetch.has(id) || !DOLLAR_FETCH_RE.test(code)) { return }
    const { imports } = await globalFetchCtx.injectImports(code, id, { autoImport: true, id } as InjectImportsOptions)
    if (imports.length > 0) {
      queueGlobalFetchReport(id)
    }
  }

  function queueGlobalFetchReport (id: string) {
    if (reportedGlobalFetch.has(id)) { return }
    reportedGlobalFetch.add(id)
    pendingGlobalFetch.add(id)
    clearTimeout(globalFetchTimer)
    globalFetchTimer = setTimeout(flushGlobalFetchReports, 100)
  }

  function flushGlobalFetchReports () {
    const ids = [...pendingGlobalFetch].sort()
    pendingGlobalFetch.clear()
    const files = ids.slice(0, MAX_REPORTED_FILES).map(id => `\`${relative(nuxt.options.rootDir, id)}\``)
    if (ids.length > MAX_REPORTED_FILES) {
      files.push(`and ${ids.length - MAX_REPORTED_FILES} more`)
    }
    nitroBuildDiagnostics.NUXT_B9011({ count: ids.length, files: files.join('\n  - ') })
  }

  /**
   * Resolve the module an import's types are read from to a specifier the generated declaration
   * file can name.
   *
   * A bare specifier is left as written so it resolves through the package's `exports` map: an
   * extensionless relative path cannot reach a subpath shipping only `foo.d.mts`, and under
   * `skipLibCheck` that silently widens every symbol from it to `any`. One that only a `modulesDir`
   * copy resolves is named under its own prefix, so its `paths` substitution leaves explicit
   * imports of the package elsewhere to their own resolution.
   */
  const resolvedTypePaths = new Map<string, string>()
  function resolveTypePaths (imports: Import[], sourceDirs: Map<string, string>) {
    for (const i of imports) {
      const from = i.typeFrom || i.from
      if (resolvedTypePaths.has(from)) { continue }

      resolvedTypePaths.set(
        from,
        isAbsolute(from)
          ? relativeWithDot(importsModuleDir, from).replace(/\.[cm]?[jt]sx?$/, '')
          : sourceDirs.has(from) ? SOURCE_TYPES_PREFIX + from : from,
      )
    }
  }

  return {
    enabled,
    importsModulePath,

    async injectImports (code, id, injectOptions) {
      if (!enabled) { return undefined }
      await init()
      // `patches/unimport@6.4.0.patch` reads `id` off the options so oxc parses each module in its
      // own language, which it infers from the filename. Server modules arrive untranspiled.
      // TODO: drop the patch, this `id`, and the version pin once unimport threads the id itself.
      const result = await ctx.injectImports(code, id, { autoImport: true, id, ...injectOptions } as InjectImportsOptions)
      const transformed = result.s.toString()
      await reportNestedUtils(transformed, id)
      await reportDisabledPresets(transformed, id)
      await reportGlobalFetch(transformed, id)
      return result
    },

    async getImports () {
      await init()
      return ctx.getImports()
    },

    async resolveSourceDir (source) {
      return (await resolveSourceDirs()).get(source)
    },

    async getSourceTypePaths () {
      const resolved = await Promise.all([...await resolveSourceDirs()].map(([source, dir]) => resolvePackageTypePaths([source], [dir], { entry: true })))
      return Object.fromEntries(resolved.flat().map(([source, path]) => [SOURCE_TYPES_PREFIX + source, [path]]))
    },

    async refresh () {
      await init()
      resolvedTypePaths.clear()
      await ctx.modifyDynamicImports((imports) => {
        imports.length = 0
        return imports
      })
      await scan()
    },

    async writeTypes () {
      await mkdir(join(typesDir, 'types'), { recursive: true })

      await init()
      const imports = await ctx.getImports()
      const sourceDirs = await resolveSourceDirs()
      resolveTypePaths(imports, sourceDirs)

      // with `autoImport: false` nothing is injected, but the registered imports stay reachable
      // through an explicit `import { x } from '#imports/server'`, so the module is still emitted;
      // only the ambient global declarations are skipped
      const declarations = enabled
        ? await ctx.generateTypeDeclarations({
            exportHelper: false,
            resolvePath: i => resolvedTypePaths.get(i.typeFrom || i.from) ?? i.from,
          })
        : ''

      // the re-exports make this a module, so `import { x } from '#imports'` resolves as well as
      // the ambient `x` the declarations provide
      const reExports = toExports(imports.map(i => sourceDirs.has(i.typeFrom || i.from) ? { ...i, typeFrom: SOURCE_TYPES_PREFIX + (i.typeFrom || i.from) } : i), importsModuleDir, true, { declaration: true })

      await Promise.all([
        writeFile(importsModulePath + '.d.ts', [declarations.trim(), reExports.trim() || 'export {}'].filter(Boolean).join('\n') + '\n', 'utf8'),
        writeFile(importsModulePath + '.mjs', renderModule(imports), 'utf8'),
      ])
    },

    async renderModule () {
      await init()
      return renderModule(await ctx.getImports())
    },
  }
}

/**
 * Resolve the directories scanned for server auto-imports across all layers.
 *
 * `nestedUtils` also scans the subdirectories of each `server/utils`.
 */
export function resolveServerImportDirs (nuxt: Nuxt, options: { nestedUtils?: boolean } = {}): string[] {
  const dirs = new Set<string>()

  for (const layer of getScannedLayers(nuxt)) {
    const shared = layer.config.dir?.shared ?? 'shared'
    dirs.add(join(layer.config.rootDir, shared, 'utils'))
    dirs.add(join(layer.config.rootDir, shared, 'types'))
    dirs.add(join(getServerDir(layer), options.nestedUtils ? 'utils/**/*' : 'utils'))
    dirs.add(join(getServerDir(layer), 'types'))
  }

  return [...dirs]
}

/** Resolve the subdirectories of each layer's `server/utils`. */
export function resolveNestedServerUtilsDirs (nuxt: Nuxt): string[] {
  return getScannedLayers(nuxt).map(layer => join(getServerDir(layer), 'utils/*/**/*'))
}

type NuxtLayer = Nuxt['options']['_layers'][number]

function getScannedLayers (nuxt: Nuxt): NuxtLayer[] {
  if (nuxt.options.imports.scan === false) { return [] }
  // Layer disabled scanning for itself
  return nuxt.options._layers.filter(layer => layer.config?.imports?.scan !== false)
}

function getServerDir (layer: NuxtLayer): string {
  return layer.config.serverDir ?? join(layer.config.rootDir, 'server')
}

const RELATIVE_RE = /^\.{1,2}\//
function relativeWithDot (from: string, to: string) {
  const rel = relative(from, to)
  return RELATIVE_RE.test(rel) ? rel : './' + rel
}
