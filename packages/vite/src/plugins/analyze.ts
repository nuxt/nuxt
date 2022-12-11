import type { Plugin } from 'vite'
import { transform } from 'esbuild'
import { visualizer } from 'rollup-plugin-visualizer'
import type { ViteBuildContext } from '../vite'

export function analyzePlugin (ctx: ViteBuildContext): Plugin[] {
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
    // @ts-ignore
    visualizer({
      ...ctx.nuxt.options.build.analyze as any,
      // @ts-ignore
      filename: ctx.nuxt.options.build.analyze.filename.replace('{name}', 'client'),
      title: 'Client bundle stats',
      gzipSize: true
    })
  ]
}
