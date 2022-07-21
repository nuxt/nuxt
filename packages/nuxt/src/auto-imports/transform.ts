import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import { Unimport } from 'unimport'
import { AutoImportsOptions } from '@nuxt/schema'
import { normalize } from 'pathe'

export const TransformPlugin = createUnplugin(({ ctx, options, sourcemap }: {ctx: Unimport, options: Partial<AutoImportsOptions>, sourcemap?: boolean }) => {
  return {
    name: 'nuxt:auto-imports-transform',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const { type, macro } = parseQuery(search)

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
        pathname.endsWith('.vue') &&
        (type === 'template' || type === 'script' || macro || !search)
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
      // For modules in node_modules, we only transform `#imports` but not doing auto-imports
      if (isNodeModule && !code.match(/(['"])#imports\1/)) {
        return
      }

      const { s } = await ctx.injectImports(code, id, { autoImport: !isNodeModule })
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap && s.generateMap({ source: id, includeContent: true })
        }
      }
    }
  }
})
