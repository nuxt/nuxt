import { createUnplugin } from 'unplugin'
import type { Unimport } from 'unimport'
import { isAbsolute, normalize } from 'pathe'
import { tryUseNuxt } from '@nuxt/kit'

import { isJS, isVue } from '../core/utils/index.ts'
import { installNuxtModule } from '../core/features.ts'
import type { ImportsOptions } from 'nuxt/schema'

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const IMPORTS_RE = /(['"])#imports\1/

function isWithin (id: string, dir: string) {
  return id === dir || id.startsWith(dir + '/')
}

// External = under node_modules, or an absolute path outside every layer root. The latter
// catches `file:`-linked deps, which vite resolves to a real path outside node_modules (#19525).
// node_modules layers stay internal via `include`.
export function isExternalId (id: string, layerRoots: string[], include?: RegExp[]) {
  if (include?.some(pattern => pattern.test(id))) {
    return false
  }
  return NODE_MODULES_RE.test(id) ||
    (layerRoots.length > 0 && isAbsolute(id) && !layerRoots.some(root => isWithin(id, root)))
}

interface TransformPluginOptions {
  ctx: Pick<Unimport, 'injectImports'>
  options: Partial<ImportsOptions>
  sourcemap?: boolean
}

export const TransformPlugin = ({ ctx, options, sourcemap }: TransformPluginOptions) => createUnplugin(() => {
  // Roots of every layer (app + local + node_modules layers), resolved once.
  const layerRoots = [...new Set(
    (tryUseNuxt()?.options._layers ?? [])
      .flatMap(layer => [layer.config.srcDir, layer.config.rootDir])
      .filter((dir): dir is string => !!dir)
      .map(dir => normalize(dir)),
  )]

  return {
    name: 'nuxt:imports-transform',
    enforce: 'post',
    transformInclude (id) {
      // Included
      if (options.transform?.include?.some(pattern => pattern.test(id))) {
        return true
      }
      // Excluded
      if (options.transform?.exclude?.some(pattern => pattern.test(id))) {
        return false
      }

      // Vue files
      if (isVue(id, { type: ['script', 'template'] })) {
        return true
      }

      // JavaScript files
      return isJS(id)
    },
    async transform (code, id) {
      id = normalize(id)
      const isExternal = isExternalId(id, layerRoots, options.transform?.include)
      // For external modules, we only transform `#imports` but do not inject auto-imports
      if (isExternal && !IMPORTS_RE.test(code)) {
        return
      }

      const { s, imports } = await ctx.injectImports(code, id, { autoImport: options.autoImport && !isExternal })
      if (imports.some(i => i.from === '#app/composables/script-stubs') && tryUseNuxt()?.options.test === false) {
        installNuxtModule('@nuxt/scripts')
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
  }
})
