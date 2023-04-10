import { pathToFileURL } from 'node:url'
import { parseQuery, parseURL } from 'ufo'
import { createTransformer } from 'unctx/transform'
import { createUnplugin } from 'unplugin'

const TRANSFORM_MARKER = '/* _processed_nuxt_unctx_transform */\n'

export const UnctxTransformPlugin = () => {
  const transformer = createTransformer({
    asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
    objectDefinitions: {
      defineComponent: ['setup'],
      defineNuxtComponent: ['setup'],
      definePageMeta: ['middleware', 'validate']
    }
  })

  return createUnplugin((options: { sourcemap?: boolean } = {}) => ({
    name: 'unctx:transform',
    enforce: 'post',
    transformInclude (id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const query = parseQuery(search)

      // Vue files
      if (
        pathname.endsWith('.vue') ||
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
    transform (code, id) {
      // TODO: needed for webpack - update transform in unctx/unplugin?
      if (code.startsWith(TRANSFORM_MARKER)) { return }
      const result = transformer.transform(code)
      if (result) {
        return {
          code: TRANSFORM_MARKER + result.code,
          map: options.sourcemap
            ? result.magicString.generateMap({ source: id, includeContent: true })
            : undefined
        }
      }
    }
  }))
}
