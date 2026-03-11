import { addBuildPlugin, defineNuxtModule, resolveFiles, resolvePath } from '@nuxt/kit'
import type { CompilerScanDir, KeyedFunction, NuxtCompilerOptions, ScanPlugin, ScanPluginFilter } from '@nuxt/schema'
import { resolve } from 'pathe'
import { DECLARATION_EXTENSIONS, isDirectorySync, logger, normalizeExtension, toArray } from '../utils.ts'
import { createScanPluginContext, matchWithStringOrRegex } from './utils.ts'
import { readFile } from 'node:fs/promises'
import { KeyedFunctionFactoriesPlugin, KeyedFunctionFactoriesScanPlugin, scanFileForFactories } from './plugins/keyed-function-factories.ts'
import type { KeyedFunctionFactoriesScanResult } from './plugins/keyed-function-factories.ts'
import type { Unimport } from 'unimport'
import { KeyedFunctionsPlugin } from './plugins/keyed-functions.ts'

export default defineNuxtModule<Partial<NuxtCompilerOptions>>({
  meta: {
    name: 'nuxt:compiler',
    configKey: 'compiler',
  },
  defaults: {
    scan: true,
  },
  setup (_options, nuxt) {
    let unimport: Unimport | undefined
    nuxt.hook('imports:context', (ctx) => {
      unimport = ctx
    })

    // Shared state for HMR — populated during build:before, accessed by builder:watch
    let scanResult: KeyedFunctionFactoriesScanResult | undefined
    let scanDirPaths: string[] = []
    let normalizedKeyedFunctions: KeyedFunction[] = []

    nuxt.hook('build:before', async () => {
      // scan raw source files for keyed function factories to register their created functions for key injection
      nuxt.options.compiler ||= {}
      nuxt.options.compiler.plugins ||= []
      const scanPlugin = KeyedFunctionFactoriesScanPlugin({
        factories: nuxt.options.optimization.keyedComposableFactories,
        alias: nuxt.options.alias,
      })
      scanResult = scanPlugin.result
      nuxt.options.compiler.plugins.push(scanPlugin)

      // replace keyed function factory compiler macro placeholders with actual factories (createUseFetch -> createUseFetch.__nuxt_factory)
      addBuildPlugin(KeyedFunctionFactoriesPlugin({
        sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
        factories: nuxt.options.optimization.keyedComposableFactories,
        alias: nuxt.options.alias,
        getAutoImports: () => unimport?.getImports() || Promise.resolve([]),
      }))

      await runScanPlugins()

      // Add keys for useFetch, useAsyncData, etc.
      // Maintained as a mutable list so HMR can add/remove entries
      normalizedKeyedFunctions = await Promise.all(nuxt.options.optimization.keyedComposables.map(async ({ source, ...rest }) => ({
        ...rest,
        source: typeof source === 'string' ? await resolvePath(source, { fallbackToOriginal: true }) : source,
      })))

      addBuildPlugin(KeyedFunctionsPlugin({
        sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
        keyedFunctions: normalizedKeyedFunctions,
        getKeyedFunctions: () => normalizedKeyedFunctions,
        alias: nuxt.options.alias,
        getAutoImports: () => unimport?.getImports() || Promise.resolve([]),
        appDir: nuxt.options.appDir,
        dev: nuxt.options.dev,
      }))
    })

    async function runScanPlugins () {
      const autoImports = await unimport?.getImports() || []
      // sources do not have aliases resolved
      const autoImportsToSources = new Map<string, string>(autoImports.map(i => [i.as || i.name, i.from]))

      // the normalized scan directories, which include only valid directories and have unique paths
      let scanDirs: Required<CompilerScanDir>[] = []
      // the scan dirs that are accessible though hooks and have not been normalized yet + may contain duplicates
      const _scanDirs: NonNullable<NuxtCompilerOptions['dirs']> = _options.dirs || []

      function addScanDir (resolvedPath: string, additionalData?: Omit<CompilerScanDir, 'path'>) {
        _scanDirs.push({ ...additionalData, path: resolvedPath })
      }

      for (const layer of nuxt.options._layers) {
        // skipping layers that disabled compiler scanning
        if (layer.config?.compiler?.scan === false) {
          continue
        }

        // default directories
        for (const path of [
          resolve(layer.config.srcDir, 'composables'),
        ]) {
          if (!isDirectorySync(path)) { continue }
          addScanDir(path)
        }

        // user-defined directories
        await Promise.all((layer.config.compiler?.dirs ?? []).map(async (dir) => {
          if (!dir) {
            return
          }

          const { path, ...rest } = typeof dir === 'string' ? { path: dir } : dir
          if (path) {
            addScanDir(await resolvePath(path, { fallbackToOriginal: true, type: 'dir' }), rest as Omit<CompilerScanDir, 'path'> | undefined)
          }
        }))
      }

      // normalize scan directories
      const dirPaths = new Set<string>()

      scanDirs = (await Promise.all(_scanDirs.map(async (dir) => {
        const dirOptions: CompilerScanDir = typeof dir === 'string' ? { path: dir } : dir
        const dirPath = await resolvePath(dirOptions.path, { fallbackToOriginal: true, type: 'dir' })

        if (dirPaths.has(dirPath)) {
          logger.warn(`[nuxt:compiler] Directory \`${dirPath}\` is already registered for scanning.`)
          return null
        }

        if (!isDirectorySync(dirPath)) {
          logger.warn(`[nuxt:compiler] Cannot find directory \`${dirPath}\`. Skipping it from scanning.`)
          return null
        }

        const extensions = (dirOptions.extensions || nuxt.options.extensions).map(e => normalizeExtension(e))
        dirPaths.add(dirPath)

        return ({
          path: dirPath,
          extensions,
          pattern: dirOptions.pattern || `**/*.{${extensions.join(',')}}`,
          ignore: [
            `**/*.{${DECLARATION_EXTENSIONS.join(',')}}`, // ignore declaration files
            ...(dirOptions.ignore || []),
          ],
        } satisfies Required<CompilerScanDir>)
      }))).filter(Boolean) as Required<CompilerScanDir>[]

      // Store dir paths for HMR watch handler
      scanDirPaths = scanDirs.map(d => d.path)

      // resolve the files from the scan directories

      const _filePaths: string[] = []
      await Promise.all(scanDirs.map(async (dir) => {
        const files = await resolveFiles(dir.path, dir.pattern, { ignore: dir.ignore })
        _filePaths.push(...files)
      }))

      // normalized absolute file paths with resolved aliases, etc.
      // However, it is NOT GUARANTEED that these files exist, since modules may insert anything
      const filePaths = await Promise.all(_filePaths.map(filePath => resolvePath(filePath)))

      // deduplicated compiler scan plugins
      const plugins: ScanPlugin[] = []

      const pluginNames = new Set<string>()
      for (const plugin of nuxt.options.compiler?.plugins || []) {
        if (!pluginNames.has(plugin.name)) {
          plugins.push(plugin)
          pluginNames.add(plugin.name)
        } else {
          logger.warn(`[nuxt:compiler] Plugin \`${plugin.name}\` is already registered. Skipping duplicate.`)
        }
      }

      // scan the files
      for (const filePath of filePaths) {
        const isFileWantedByPlugin = plugins.some((p) => {
          if (!p.filter?.id) { return true }
          return matchFilter(filePath, p.filter.id)
        })

        if (!isFileWantedByPlugin) { continue }

        try {
          const contents = await readFile(filePath, 'utf-8')

          const pluginScanThisContext = createScanPluginContext(contents, filePath)

          await Promise.all(plugins.map(async (plugin) => {
            if (plugin.filter?.id && !matchFilter(filePath, plugin.filter.id)) { return }
            if (plugin.filter?.code && !matchFilter(contents, plugin.filter.code)) { return }

            try {
              await plugin.scan.call(pluginScanThisContext, ({ id: filePath, code: contents, nuxt, autoImportsToSources }))
            } catch (e) {
              logger.error(`[nuxt:compiler] Plugin \`${plugin.name}\` failed to scan file \`${filePath}\``, e)
            }
          }))
        } catch (e) {
          logger.error(`[nuxt:compiler] Cannot read file \`${filePath}\``, e)
        }
      }

      await Promise.all(plugins.map(async (plugin) => {
        if (!plugin.afterScan) { return }
        try {
          await plugin.afterScan(nuxt)
        } catch (e) {
          logger.error(`[nuxt:compiler] Error in \`afterScan\` hook of plugin \`${plugin.name}\``, e)
        }
      }))
    }

    // HMR: incrementally re-scan files when composable directories change
    if (nuxt.options.dev) {
      nuxt.hook('builder:watch', async (event, relativePath) => {
        if (!scanResult || !['add', 'change', 'unlink'].includes(event)) { return }

        const absolutePath = resolve(nuxt.options.srcDir, relativePath)
        const isInScanDir = scanDirPaths.some(dir => absolutePath === dir || absolutePath.startsWith(dir + '/'))
        if (!isInScanDir) { return }

        const { fileResults, factoryNamesRegex, namesToFactoryMeta } = scanResult

        // Remove old entries for this file from normalizedKeyedFunctions.
        // All entries from a given scan have source === absolutePath, which gets
        // normalized via resolvePath. We match on the resolved path.
        const oldEntries = fileResults.get(absolutePath)
        if (oldEntries?.length) {
          const resolvedSource = await resolvePath(absolutePath, { fallbackToOriginal: true })
          for (let i = normalizedKeyedFunctions.length - 1; i >= 0; i--) {
            if (normalizedKeyedFunctions[i]!.source === resolvedSource) {
              normalizedKeyedFunctions.splice(i, 1)
            }
          }
          fileResults.delete(absolutePath)
        }

        // For deletions, we're done
        if (event === 'unlink') { return }

        // Read file and check if it contains any factory names (fast prefilter)
        let contents: string
        try {
          contents = await readFile(absolutePath, 'utf-8')
        } catch {
          return // file may not exist yet or be temporarily unavailable
        }

        if (!factoryNamesRegex.test(contents)) { return }

        // Build auto-imports map
        const autoImports = await unimport?.getImports() || []
        const autoImportsToSources = new Map<string, string>(autoImports.map(i => [i.as || i.name, i.from]))

        // Scan the single file
        const newEntries = scanFileForFactories(
          absolutePath,
          contents,
          namesToFactoryMeta,
          autoImportsToSources,
          nuxt.options.alias,
        )

        if (newEntries.length) {
          fileResults.set(absolutePath, newEntries)

          // Normalize and add to the mutable list
          const normalized = await Promise.all(newEntries.map(async ({ source, ...rest }) => ({
            ...rest,
            source: typeof source === 'string' ? await resolvePath(source, { fallbackToOriginal: true }) : source,
          })))
          normalizedKeyedFunctions.push(...normalized)
        }
      })
    }
  },
})

/**
 * Checks if the input satisfies the provided filter.
 * @param input the string to check against the filter
 * @param filter the filter to apply
 */
function matchFilter (input: string, filter: ScanPluginFilter) {
  if (typeof filter === 'function') { return filter(input) }
  const include = filter.include ? toArray(filter.include).some(v => matchWithStringOrRegex(input, v)) : true
  const exclude = filter.exclude ? toArray(filter.exclude).some(v => matchWithStringOrRegex(input, v)) : false
  return include && !exclude
}
