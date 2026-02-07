import type { Plugin, ResolvedConfig } from 'vite'
import { transformWithOxc } from 'vite'
import { defu } from 'defu'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import type { RenderedModule } from 'rolldown'

export async function AnalyzePlugin (nuxt: Nuxt): Promise<Plugin | undefined> {
  if (nuxt.options.test) {
    return
  }

  const analyzeOptions = defu({}, nuxt.options.build.analyze) as Exclude<NuxtOptions['build']['analyze'], boolean>
  if (!analyzeOptions.enabled) {
    return
  }

  const { visualizer } = await import('rollup-plugin-visualizer')
  let config: ResolvedConfig

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
