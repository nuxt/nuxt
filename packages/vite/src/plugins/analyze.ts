import type { Plugin } from 'vite'
import { transform } from 'esbuild'
import { visualizer } from 'rollup-plugin-visualizer'
import defu from 'defu'
import type { NuxtOptions } from 'nuxt/schema'
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
          if (bundle.type !== 'chunk') { continue }
          const originalEntries = []
          for (const moduleId in bundle.modules) {
            const module = bundle.modules[moduleId]
            originalEntries.push(transform(module.code || '', { minify: true }).then(result => {
              return [moduleId, { ...module, code: result.code }];
            }))
          }
          const minifiedEntries = await Promise.all(originalEntries)
          bundle.modules = Object.fromEntries(minifiedEntries)
        }
      },
    },
    visualizer({
      ...analyzeOptions,
      filename: 'filename' in analyzeOptions ? analyzeOptions.filename!.replace('{name}', 'client') : undefined,
      title: 'Client bundle stats',
      gzipSize: true,
    }),
  ]
}
