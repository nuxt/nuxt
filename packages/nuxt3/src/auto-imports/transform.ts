import { pathToFileURL } from 'url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import { Unimport } from 'unimport'
import { AutoImportsOptions } from '@nuxt/schema'

export const TransformPlugin = createUnplugin(({ ctx, options }: {ctx: Unimport, options: Partial<AutoImportsOptions> }) => {
  return {
    name: 'nuxt:auto-imports-transform',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const { type, macro } = parseQuery(search)

      const exclude = options.transform?.exclude || [/[\\/]node_modules[\\/]/]

      // Exclude node_modules by default
      if (exclude.some(pattern => id.match(pattern))) {
        return false
      }

      // vue files
      if (
        pathname.endsWith('.vue') &&
        (type === 'template' || type === 'script' || macro || !search)
      ) {
        return true
      }

      // js files
      if (pathname.match(/\.((c|m)?j|t)sx?$/g)) {
        return true
      }
    },
    async transform (_code, id) {
      const { code, s } = await ctx.injectImports(_code)
      if (code === _code) {
        return
      }
      return {
        code,
        map: s.generateMap({ source: id, includeContent: true })
      }
    }
  }
})
