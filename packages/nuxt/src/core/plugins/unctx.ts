import { normalize } from 'pathe'
import { createTransformer } from 'unctx/transform'
import { createUnplugin } from 'unplugin'
import type { Nuxt, NuxtApp } from 'nuxt/schema'

const TRANSFORM_MARKER = '/* _processed_nuxt_unctx_transform */\n'

export const UnctxTransformPlugin = (nuxt: Nuxt) => {
  const transformer = createTransformer({
    asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware']
  })

  let app: NuxtApp | undefined
  nuxt.hook('app:resolve', (_app) => { app = _app })

  return createUnplugin((options: { sourcemap?: boolean } = {}) => ({
    name: 'unctx:transform',
    enforce: 'post',
    transformInclude (id) {
      if (id.includes('macro=true')) { return true }

      id = normalize(id).replace(/\?.*$/, '')
      return app?.plugins.some(i => i.src === id) || app?.middleware.some(m => m.path === id)
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
