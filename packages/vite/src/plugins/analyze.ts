import type { Plugin } from 'vite'
import { transform } from 'esbuild'
import { visualizer } from 'rollup-plugin-visualizer'
import defu from 'defu'
import type { NuxtOptions } from 'nuxt/schema'
import type { RenderedModule } from 'rollup'
import type { ViteBuildContext } from '../vite'

export function analyzePlugin (ctx: ViteBuildContext): Plugin[] {
  const analyzeOptions = defu({}, ctx.nuxt.options.build.analyze) as Exclude<NuxtOptions['build']['analyze'], boolean>
  if (!analyzeOptions.enabled) { return [] }

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
              transform(module.code || '', { minify: true })
                .then(result => [moduleId, { ...module as RenderedModule, code: result.code }]),
            )
          }
          bundle.modules = Object.fromEntries(await Promise.all(minifiedModuleEntryPromises))
        }
      },
    },
    visualizer({
      ...analyzeOptions,
      filename: 'filename' in analyzeOptions ? analyzeOptions.filename!.replace('{name}', 'client') : undefined,
      title: 'Client bundle stats',
      gzipSize: true,
      brotliSize: true,
    }),
  ]
}
