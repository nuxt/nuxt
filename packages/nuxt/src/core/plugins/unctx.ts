import type { TransformerOptions } from 'unctx/transform'
import { createTransformer } from 'unctx/transform'
import { createUnplugin } from 'unplugin'

import { isJS, isVue } from '../utils'

const TRANSFORM_MARKER = '/* _processed_nuxt_unctx_transform */\n'

interface UnctxTransformPluginOptions {
  sourcemap?: boolean
  transformerOptions: TransformerOptions
}

export const UnctxTransformPlugin = createUnplugin((options: UnctxTransformPluginOptions) => {
  const transformer = createTransformer(options.transformerOptions)
  return {
    name: 'unctx:transform',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id) || isJS(id)
    },
    transform (code) {
      // TODO: needed for webpack - update transform in unctx/unplugin?
      if (code.startsWith(TRANSFORM_MARKER) || !transformer.shouldTransform(code)) { return }
      const result = transformer.transform(code)
      if (result) {
        return {
          code: TRANSFORM_MARKER + result.code,
          map: options.sourcemap
            ? result.magicString.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})
