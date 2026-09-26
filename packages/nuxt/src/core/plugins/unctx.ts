import type { Transformer, TransformerOptions } from 'unctx/transform'
import { createTransformer, getTransformFilter } from 'unctx/transform'
import { createUnplugin } from 'unplugin'

import { JS_ID_RE, VUE_SCRIPT_TEMPLATE_ID_FILTER } from '../utils/index.ts'

const TRANSFORM_MARKER = '/* _processed_nuxt_unctx_transform */\n'
const TRANSFORM_MARKER_RE = /^\/\* _processed_nuxt_unctx_transform \*\/\n/

interface UnctxTransformPluginOptions {
  sourcemap?: boolean
  transformerOptions: TransformerOptions
}

export const UnctxTransformPlugin = (options: UnctxTransformPluginOptions) => createUnplugin(() => {
  let transformer: Promise<Transformer> | undefined
  const filter = getTransformFilter(options.transformerOptions)

  return {
    name: 'unctx:transform',
    enforce: 'post',
    transform: {
      filter: {
        id: { include: [...VUE_SCRIPT_TEMPLATE_ID_FILTER, JS_ID_RE] },
        code: {
          include: filter.code,
          exclude: TRANSFORM_MARKER_RE,
        },
      },
      async handler (code) {
        const { shouldTransform, transform } = await (transformer ??= createTransformer(options.transformerOptions))
        // TODO: needed for webpack - update transform in unctx/unplugin?
        if (!shouldTransform(code)) { return }
        const result = transform(code)
        if (result) {
          result.magicString.prepend(TRANSFORM_MARKER)
          return {
            code: result.magicString.toString(),
            map: options.sourcemap
              ? result.magicString.generateMap({ hires: true })
              : undefined,
          }
        }
      },
    },
  }
})
