import { Nuxt, NuxtApp } from '@nuxt/schema'
import { normalize } from 'pathe'
import { createTransformer } from 'unctx/transform'
import { createUnplugin } from 'unplugin'

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
      id = normalize(id).replace(/\?.*$/, '')
      return app?.plugins.some(i => i.src === id) || app?.middleware.some(m => m.path === id)
    },
    transform (code, id) {
      const result = transformer.transform(code)
      if (result) {
        return {
          code: result.code,
          map: options.sourcemap
            ? result.magicString.generateMap({ source: id, includeContent: true })
            : undefined
        }
      }
    }
  }))
}
