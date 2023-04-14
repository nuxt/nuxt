import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import type { Unimport } from 'unimport'
import { normalize } from 'pathe'
import type { ImportsOptions } from 'nuxt/schema'

export const TransformPlugin = createUnplugin(({ ctx, options, sourcemap }: { ctx: Unimport, options: Partial<ImportsOptions>, sourcemap?: boolean }) => {
  return {
    name: 'nuxt:imports-transform',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const query = parseQuery(search)

      // Included
      if (options.transform?.include?.some(pattern => id.match(pattern))) {
        return true
      }
      // Excluded
      if (options.transform?.exclude?.some(pattern => id.match(pattern))) {
        return false
      }

      // Vue files
      if (
        id.endsWith('.vue') ||
        'macro' in query ||
        ('vue' in query && (query.type === 'template' || query.type === 'script' || 'setup' in query))
      ) {
        return true
      }

      // JavaScript files
      if (pathname.match(/\.((c|m)?j|t)sx?$/g)) {
        return true
      }
    },
    async transform (code, id) {
      id = normalize(id)
      const isNodeModule = id.match(/[\\/]node_modules[\\/]/) && !options.transform?.include?.some(pattern => id.match(pattern))
      // For modules in node_modules, we only transform `#imports` but not doing imports
      if (isNodeModule && !code.match(/(['"])#imports\1/)) {
        return
      }

      const { s } = await ctx.injectImports(code, id, { autoImport: options.autoImport && !isNodeModule })
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap
            ? s.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})
