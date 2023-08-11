import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Nuxt } from '@nuxt/schema'
import { isVue } from '../core/utils'

const INJECTION_RE = /\b_ctx\.\$route\b/g
const INJECTION_SINGLE_RE = /\b_ctx\.\$route\b/

export const RouteInjectionPlugin = (nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:route-injection-plugin',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id, { type: ['template', 'script'] })
    },
    transform (code) {
      if (!INJECTION_SINGLE_RE.test(code) || code.includes('_ctx._.provides[__nuxt_route_symbol')) { return }

      let replaced = false
      const s = new MagicString(code)
      s.replace(INJECTION_RE, () => {
        replaced = true
        return '(_ctx._.provides[__nuxt_route_symbol] || _ctx.$route)'
      })
      if (replaced) {
        s.prepend('import { PageRouteSymbol as __nuxt_route_symbol } from \'#app/components/injections\';\n')
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server
            ? s.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})
