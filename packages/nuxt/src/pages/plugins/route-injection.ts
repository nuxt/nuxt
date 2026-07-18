import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { Nuxt } from '@nuxt/schema'
import { parseAndWalk } from 'oxc-walker'
import { isVue } from '../../core/utils/index.ts'

const INJECTION_SINGLE_RE = /\bthis\.\$route\b|\b_ctx\.\$route\b/

export const RouteInjectionPlugin = (_nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:route-injection-plugin',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id, { type: ['template', 'script'] })
    },
    transform: {
      filter: {
        code: {
          include: INJECTION_SINGLE_RE,
          exclude: [
            `_ctx._.provides[__nuxt_route_symbol`,
            'this._.provides[__nuxt_route_symbol',
          ],
        },
      },
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)

        parseAndWalk(code, id, (node) => {
          if (node.type !== 'MemberExpression') { return }

          // Check for this.$route pattern
          if (node.object.type === 'ThisExpression' && node.property.type === 'Identifier' && node.property.name === '$route') {
            s.overwrite(node.start, node.end, '(this._.provides[__nuxt_route_symbol] || this.$route)')
            return
          }

          // Check for _ctx.$route pattern
          if (node.object.type === 'Identifier' && node.object.name === '_ctx' && node.property.type === 'Identifier' && node.property.name === '$route') {
            s.overwrite(node.start, node.end, '(_ctx._.provides[__nuxt_route_symbol] || _ctx.$route)')
          }
        })

        if (s.hasChanged()) {
          s.prepend('import { PageRouteSymbol as __nuxt_route_symbol } from \'#app/components/injections\';\n')
        }
        return generateTransform(s, id)
      },
    },

  }
})
