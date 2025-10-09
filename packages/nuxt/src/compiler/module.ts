import { addBuildPlugin, addCompilerScanPlugin, defineNuxtModule, resolveFiles, resolvePath } from '@nuxt/kit'
import type { CompilerScanDir, NuxtCompilerOptions, ScanPlugin, ScanPluginFilter } from '@nuxt/schema'
import { resolve } from 'pathe'
import { DECLARATION_EXTENSIONS, isDirectorySync, logger, normalizeExtension, toArray } from '../utils'
import { matchWithStringOrRegex } from './utils'
import { readFile } from 'node:fs/promises'
import { KeyedFunctionFactoriesPlugin, KeyedFunctionFactoriesScanPlugin } from './plugins/keyed-function-factories'
import { createScanPluginContext } from './parse-utils'
import { distDir } from '../dirs.ts'
import type { Import } from 'unimport'
import { KeyedFunctionsPlugin } from './plugins/keyed-functions.ts'

const runtimeDir = resolve(distDir, 'compiler/runtime')

export default defineNuxtModule<Partial<NuxtCompilerOptions>>({
  meta: {
    name: 'nuxt:compiler',
    configKey: 'compiler',
  },
  defaults: {
    scan: true,
  },
  setup (_options, nuxt) {
    nuxt.hook('modules:done', async () => {
      // scan raw source files for keyed function factories to register their created functions for key injection
      addCompilerScanPlugin(KeyedFunctionFactoriesScanPlugin({
        factories: nuxt.options.optimization.keyedComposableFactories,
      }))

      // replace keyed function factory compiler macro placeholders with actual factories
      addBuildPlugin(KeyedFunctionFactoriesPlugin({
        sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
        factories: nuxt.options.optimization.keyedComposableFactories,
      }))

      // Add keys for useFetch, useAsyncData, etc.
      const normalizedKeyedFunctions = await Promise.all(nuxt.options.optimization.keyedComposables.map(async ({ source, ...rest }) => ({
        ...rest,
        source: typeof source === 'string' ? await resolvePath(source, { fallbackToOriginal: true }) : source,
      })))

      addBuildPlugin(KeyedFunctionsPlugin({
        sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
        keyedFunctions: normalizedKeyedFunctions,
      }))
    })

    nuxt.hook('imports:extend', (imports) => {
      imports.push(
        { name: 'defineKeyedFunctionFactory', as: 'defineKeyedFunctionFactory', from: resolve(runtimeDir, 'index') },
      )
    })

    let unhookOldBuilderWatcher: (() => void) | undefined

    async function runScanPlugins (autoImports: Import[]) {
      // sources do not have aliases resolved
      const autoImportsToSources = new Map<string, string>(autoImports.map(i => [i.as || i.name, i.from]))

      unhookOldBuilderWatcher?.()

      // the normalized scan directories, which include only valid directories and have unique paths
      let scanDirs: Required<CompilerScanDir>[] = []
      // the scan dirs that are accessible though hooks and have not been normalized yet + may contain duplicates
      const _scanDirs: NonNullable<NuxtCompilerOptions['dirs']> = []

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

      await nuxt.callHook('compiler:dirs', _scanDirs)

      // normalize scan directories
      const dirPaths = new Set<string>()

      scanDirs = (await Promise.all(_scanDirs.map(async (dir) => {
        const dirOptions: CompilerScanDir = typeof dir === 'string' ? { path: dir } : dir
        const dirPath = await resolvePath(dirOptions.path, { fallbackToOriginal: true, type: 'dir' })

        if (dirPaths.has(dirPath)) {
          logger.warn(`[nuxt:compiler] Directory \`${dirPath}\` is already registered for scanning.`)
          return
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
          pattern: dirOptions.pattern || `**/*.{${extensions.join(',')},}`,
          ignore: [
            `**/*.{${DECLARATION_EXTENSIONS.join(',')},}`, // ignore declaration files
            ...(dirOptions.ignore || []),
          ],
        } satisfies Required<CompilerScanDir>)
      }))).filter(Boolean) as Required<CompilerScanDir>[]

      // resolve the files from the scan directories

      const _filePaths: string[] = []
      await Promise.all(scanDirs.map(async (dir) => {
        const files = await resolveFiles(dir.path, dir.pattern, { ignore: dir.ignore })
        _filePaths.push(...files)
      }))

      await nuxt.callHook('compiler:files', _filePaths)

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

      // watch for changes in scan directories
      unhookOldBuilderWatcher = nuxt.hook('builder:watch', (_, relativePath) => {
        const path = resolve(nuxt.options.srcDir, relativePath)
        if (!scanDirs.some(dir => dir.path === path)) {
          return
        }

        // TODO: can we handle this more gracefully without restarting the whole Nuxt instance?
        return nuxt.callHook('restart')
      })
    }

    nuxt.hook('imports:generated', (imports) => {
      return runScanPlugins(imports)
    })
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
