import { mkdir, writeFile } from 'node:fs/promises'
import { createIsIgnored } from '@nuxt/kit'
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
    ? createUnimport({ parser: 'oxc', presets: disabledPresets, imports: [], addons: { addons: [] } })
    : undefined
  const reportedPresetFiles = new Set<string>()
  const pendingPresetReports = new Map<string, Import[]>()
  let presetReportTimer: ReturnType<typeof setTimeout> | undefined

  // the project comes first in `_layers`, so it gets the highest priority; the floor of 1 is
  // unimport's default, so a scanned util still takes precedence over a preset of the same name
  const layerPriorities = nuxt.options._layers
    .map((layer, i) => [layer.config.rootDir, nuxt.options._layers.length - i] as const)
    .sort(([a], [b]) => b.length - a.length)

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
        i.priority ??= layerPriorities.find(([dir]) => i.from === dir || i.from.startsWith(dir + '/'))?.[1]
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
    const { imports } = await disabledPresetsCtx.injectImports(code, id, { autoImport: true, id } as InjectImportsOptions)
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
        names.add(i.as ?? i.name)
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

  /**
   * Resolve the module an import's types are read from to a specifier the generated declaration
   * file can name.
   *
   * A bare specifier is left as written so it resolves through the package's `exports` map: an
   * extensionless relative path cannot reach a subpath shipping only `foo.d.mts`, and under
   * `skipLibCheck` that silently widens every symbol from it to `any`.
   */
  const resolvedTypePaths = new Map<string, string>()
  function resolveTypePaths (imports: Import[]) {
    for (const i of imports) {
      const from = i.typeFrom || i.from
      if (resolvedTypePaths.has(from)) { continue }

      resolvedTypePaths.set(
        from,
        isAbsolute(from)
          ? relativeWithDot(importsModuleDir, from).replace(/\.[cm]?[jt]sx?$/, '')
          : from,
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
      await reportNestedUtils(result.s.toString(), id)
      await reportDisabledPresets(result.s.toString(), id)
      return result
    },

    async getImports () {
      await init()
      return ctx.getImports()
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
      resolveTypePaths(imports)

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
      const reExports = toExports(imports, importsModuleDir, true)

      await Promise.all([
        writeFile(importsModulePath + '.d.ts', [declarations.trim(), reExports.trim() || 'export {}'].filter(Boolean).join('\n') + '\n', 'utf8'),
        writeFile(importsModulePath + '.mjs', (toExports(imports, importsModuleDir).trim() || 'export {}') + '\n', 'utf8'),
      ])
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
