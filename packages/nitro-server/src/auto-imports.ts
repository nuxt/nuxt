import { mkdir, writeFile } from 'node:fs/promises'
import { createIsIgnored } from '@nuxt/kit'
import { dirname, isAbsolute, join, relative } from 'pathe'
import { createUnimport, scanDirExports, toExports } from 'unimport'
import type { Import, InjectImportsOptions, Unimport } from 'unimport'
import type { Nuxt, ServerImportsOptions } from '@nuxt/schema'

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

/** Creates and applies the auto-imports available to the modules the server builder bundles. */
export function createServerAutoImports (nuxt: Nuxt, options: ServerImportsOptions, typesDir: string): ServerAutoImports {
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
      return ctx.injectImports(code, id, { autoImport: true, id, ...injectOptions } as InjectImportsOptions)
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

/** Resolve the directories scanned for server auto-imports across all layers. */
export function resolveServerImportDirs (nuxt: Nuxt): string[] {
  const dirs = new Set<string>()
  if (nuxt.options.imports.scan === false) { return [] }

  for (const layer of nuxt.options._layers) {
    // Layer disabled scanning for itself
    if (layer.config?.imports?.scan === false) { continue }

    const shared = layer.config.dir?.shared ?? 'shared'
    dirs.add(join(layer.config.rootDir, shared, 'utils'))
    dirs.add(join(layer.config.rootDir, shared, 'types'))
    dirs.add(join(layer.config.serverDir ?? join(layer.config.rootDir, 'server'), 'utils'))
    dirs.add(join(layer.config.serverDir ?? join(layer.config.rootDir, 'server'), 'types'))
  }

  return [...dirs]
}

const RELATIVE_RE = /^\.{1,2}\//
function relativeWithDot (from: string, to: string) {
  const rel = relative(from, to)
  return RELATIVE_RE.test(rel) ? rel : './' + rel
}
