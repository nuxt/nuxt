import process from 'node:process'
import type { Plugin, ResolvedConfig } from 'vite'
import { transformWithOxc } from 'vite'
import { defu } from 'defu'
import { addDependency } from 'nypm'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import type { RenderedModule } from 'rolldown'
import { logger } from '@nuxt/kit'
import { hasTTY, isCI } from 'std-env'

export async function AnalyzePlugin (nuxt: Nuxt): Promise<Plugin | undefined> {
  if (nuxt.options.test) {
    return
  }

  const analyzeOptions = defu({}, nuxt.options.build.analyze) as Exclude<NuxtOptions['build']['analyze'], boolean>
  if (!analyzeOptions.enabled) {
    return
  }

  let visualizer: typeof import('rollup-plugin-visualizer').visualizer
  let config: ResolvedConfig

  try {
    visualizer = await import('rollup-plugin-visualizer').then(r => r.visualizer)
  } catch (_err) {
    const err = _err as NodeJS.ErrnoException

    if (err.code !== 'ERR_MODULE_NOT_FOUND' && err.code !== 'MODULE_NOT_FOUND') {
      throw err
    }

    if (!isCI && hasTTY) {
      logger.info('Analyzing bundles requires an additional dependency.')
      const shouldInstall = await logger.prompt('Install `rollup-plugin-visualizer`?', {
        type: 'confirm',
        choices: [
          { name: 'Yes', value: true },
          { name: 'No', value: false },
        ],
      })

      if (shouldInstall) {
        logger.start('Installing `rollup-plugin-visualizer`...')
        await addDependency('rollup-plugin-visualizer', {
          dev: true,
          cwd: nuxt.options.rootDir,
          silent: true,
        })
        logger.info('Rerun Nuxt to analyze your bundle.')
        process.exit(1)
      }
    }

    logger.info('Cannot find `rollup-plugin-visualizer`.')
    process.exit(1)
  }

  return {
    name: 'nuxt:analyze',
    configResolved (_config) {
      config = _config
    },
    applyToEnvironment (environment) {
      if (environment.name !== 'client') {
        return false
      }
      return [
        {
          name: 'nuxt:analyze-minify',
          async generateBundle (_opts, outputBundle) {
            for (const _bundleId in outputBundle) {
              const bundle = outputBundle[_bundleId]
              if (!bundle || bundle.type !== 'chunk') { continue }
              const minifiedModuleEntryPromises: Array<Promise<[string, RenderedModule]>> = []
              for (const [moduleId, module] of Object.entries(bundle.modules)) {
                minifiedModuleEntryPromises.push(
                  transformWithOxc(module.code || '', _bundleId, {}, undefined, config)
                    .then(result => [moduleId, { ...module, code: result.code }]),
                )
              }
              bundle.modules = Object.fromEntries(await Promise.all(minifiedModuleEntryPromises))
            }
          },
        },
        visualizer({
          ...analyzeOptions,
          filename: 'filename' in analyzeOptions && analyzeOptions.filename ? analyzeOptions.filename.replace('{name}', 'client') : undefined,
          title: 'Client bundle stats',
          gzipSize: true,
          brotliSize: true,
        }),
      ]
    },
  }
}
