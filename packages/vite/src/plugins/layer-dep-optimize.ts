import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { join, normalize } from 'pathe'
import { getLayerDirectories } from '@nuxt/kit'

export function LayerDepOptimizePlugin (nuxt: Nuxt): Plugin | undefined {
  if (!nuxt.options.dev) {
    return
  }

  // TODO: this may no longer be needed with most recent vite version
  // Identify which layers will need to have an extra resolve step.
  const layerDirs: string[] = []
  const delimitedRootDir = nuxt.options.rootDir + '/'
  for (const dirs of getLayerDirectories(nuxt)) {
    if (dirs.app !== nuxt.options.srcDir && !dirs.app.startsWith(delimitedRootDir)) {
      layerDirs.push(dirs.app)
    }
  }

  if (layerDirs.length > 0) {
    // Reverse so longest/most specific directories are searched first
    layerDirs.sort().reverse()
    const dirs = [...layerDirs]
    return {
      name: 'nuxt:optimize-layer-deps',
      enforce: 'pre',
      resolveId: {
        async handler (source, _importer) {
          if (!_importer) { return }
          const importer = normalize(_importer)
          const layerIndex = dirs.findIndex(dir => importer.startsWith(dir))
          // Trigger vite to optimize dependencies imported within a layer, just as if they were imported in final project
          if (layerIndex !== -1) {
            dirs.splice(layerIndex, 1)
            await this.resolve(source, join(nuxt.options.srcDir, 'index.html'), { skipSelf: true }).catch(() => null)
          }
        },
      },
    }
  }
}
