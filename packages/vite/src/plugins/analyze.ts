import type { Plugin } from 'vite'
import { transform } from 'esbuild'
import { visualizer } from 'rollup-plugin-visualizer'
import type { ViteBuildContext } from '../vite'

export function analyzePlugin (ctx: ViteBuildContext): Plugin[] {
  if (typeof ctx.nuxt.options.build.analyze === 'boolean') { return [] }

  return [
    {
      name: 'nuxt:analyze-minify',
      async generateBundle (_opts, outputBundle) {
        for (const [_bundleId, bundle] of Object.entries(outputBundle)) {
          if (bundle.type !== 'chunk') { continue }
          const originalEntries = Object.entries(bundle.modules)
          const minifiedEntries = await Promise.all(originalEntries.map(async ([moduleId, module]) => {
            const { code } = await transform(module.code || '', { minify: true })
            return [moduleId, { ...module, code }]
          }))
          bundle.modules = Object.fromEntries(minifiedEntries)
        }
      }
    },
    visualizer({
      ...ctx.nuxt.options.build.analyze,
      filename: 'filename' in ctx.nuxt.options.build.analyze ? ctx.nuxt.options.build.analyze.filename!.replace('{name}', 'client') : undefined,
      title: 'Client bundle stats',
      gzipSize: true
    })
  ]
}
