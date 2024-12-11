import { createUnplugin } from 'unplugin'
import { logger } from '@nuxt/kit'
import MagicString from 'magic-string'
import { isVue } from '../../core/utils'

export const DelayedHydrationPlugin = (options: { sourcemap: boolean }) => createUnplugin(() => {
  const DELAYED_HYDRATION_RE = /<(?:Lazy|lazy-)([A-Z]\w*|[\w-]+)\b([^>]+)hydrate:(\w+)(="([^"]+)")?([ />])([^>]*(?:(?<=\/)|>[\s\S]+?<\/Lazy[A-Z]\w*|lazy-[\w-]+))>/g
  const types = new Map([['time', 'Time'], ['promise', 'Promise'], ['if', 'If'], ['event', 'Event'], ['visible', 'Visible'], ['media', 'Media'], ['never', 'Never'], ['idle', 'Idle']])
  const correctVals = new Map([['time', 'number'], ['promise', 'Promise'], ['event', 'string | string[]'], ['visible', 'IntersectionObserverInit'], ['media', 'string'], ['idle', 'number']])
  return {
    name: 'nuxt:delayed-hydration',
    enforce: 'pre',
    transformInclude (id) {
      return isVue(id)
    },
    transform (code, id) {
      const s = new MagicString(code)
      s.replace(DELAYED_HYDRATION_RE, (_, comp, pre, type, selfOrValue, val, nearEndChar, post) => {
        const shouldDefault = type !== 'if' && (val === 'true' || val === 'false')
        if (!types.has(type)) { logger.warn(`Unexpected hydration strategy \`${type}\` when parsing \`${_}\` in \`${id}\`, this will default to visibility. For custom strategies, please use \`v-hydrate:if\` in stead.`) }
        if (type === 'never' && selfOrValue) { logger.warn('`hydrate:never` does not accept any value. It is meant to be used as is, and the value will not affect its runtime behavior.') }
        if (shouldDefault) { logger.warn(`Invalid value \`${val}\` for \`hydrate:${type}\` when parsing \`${_}\` in \`${id}\`. The prop is not meant to be assigned a boolean, but used as is or given ${type === 'never' ? 'no value' : `a value of type \`${correctVals.get(type) ?? 'unknown'}\``}. This will not affect runtime behavior and the defaults will be used in stead.`) }
        return `<Lazy${types.get(type) ?? 'Visible'}${comp}${pre}${type == 'never' || shouldDefault ? '' : `:hydrate="${val}"`}${nearEndChar}${post}>`
      })
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
  }
})
