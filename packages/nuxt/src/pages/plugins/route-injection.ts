import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Nuxt } from '@nuxt/schema'
import { stripLiteral } from 'strip-literal'
import { isVue } from '../../core/utils'

const INJECTION_RE_TEMPLATE = /\b_ctx\.\$route\b/g
const INJECTION_RE_SCRIPT = /\bthis\.\$route\b/g

const INJECTION_SINGLE_RE = /\bthis\.\$route\b|\b_ctx\.\$route\b/

export const RouteInjectionPlugin = (nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:route-injection-plugin',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id, { type: ['template', 'script'] })
    },
    transform: {
      filter: {
        code: { include: INJECTION_SINGLE_RE },
      },
      handler (code) {
        if (code.includes('_ctx._.provides[__nuxt_route_symbol') || code.includes('this._.provides[__nuxt_route_symbol')) { return }

        let replaced = false
        const s = new MagicString(code)
        const strippedCode = stripLiteral(code)

        // Local helper function for regex-based replacements using `strippedCode`
        const replaceMatches = (regExp: RegExp, replacement: string) => {
          for (const match of strippedCode.matchAll(regExp)) {
            const start = match.index!
            const end = start + match[0].length
            s.overwrite(start, end, replacement)
            replaced ||= true
          }
        }

        // handles `$route` in template
        replaceMatches(INJECTION_RE_TEMPLATE, '(_ctx._.provides[__nuxt_route_symbol] || _ctx.$route)')

        // handles `this.$route` in script
        replaceMatches(INJECTION_RE_SCRIPT, '(this._.provides[__nuxt_route_symbol] || this.$route)')

        if (replaced) {
          s.prepend('import { PageRouteSymbol as __nuxt_route_symbol } from \'#app/components/injections\';\n')
        }

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server
              ? s.generateMap({ hires: true })
              : undefined,
          }
        }
      },
    },

  }
})
