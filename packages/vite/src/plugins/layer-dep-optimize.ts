import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { join, normalize } from 'pathe'
import { getLayerDirectories } from '@nuxt/kit'

export function LayerDepOptimizePlugin (nuxt: Nuxt): Plugin | undefined {
  if (!nuxt.options.dev) {
    return
  }

  // Secondary fix: resolveId triggers optimization when a dep is first imported from a layer.
  // Primary fix is adding layer app dirs to optimizeDeps.entries in client.ts (see #28631).
  // Identify which layers will need to have an extra resolve step.
  const layerDirs: string[] = []
  const rootDirWithSlash = nuxt.options.rootDir + (nuxt.options.rootDir.endsWith('/') ? '' : '/')
  for (const dirs of getLayerDirectories(nuxt)) {
    if (dirs.app !== nuxt.options.srcDir && !dirs.app.startsWith(rootDirWithSlash)) {
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
