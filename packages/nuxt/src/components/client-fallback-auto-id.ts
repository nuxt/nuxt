import { createUnplugin } from 'unplugin'
import type { ComponentsOptions } from '@nuxt/schema'
import MagicString from 'magic-string'
import { isAbsolute, relative } from 'pathe'
import { hash } from 'ohash'
import { isVue } from '../core/utils'
interface LoaderOptions {
  sourcemap?: boolean
  transform?: ComponentsOptions['transform'],
  rootDir: string
}
const CLIENT_FALLBACK_RE = /<(NuxtClientFallback|nuxt-client-fallback)( [^>]*)?>/
const CLIENT_FALLBACK_GLOBAL_RE = /<(NuxtClientFallback|nuxt-client-fallback)( [^>]*)?>/g
export const clientFallbackAutoIdPlugin = createUnplugin((options: LoaderOptions) => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []

  return {
    name: 'nuxt:client-fallback-auto-id',
    enforce: 'pre',
    transformInclude (id) {
      if (exclude.some(pattern => id.match(pattern))) {
        return false
      }
      if (include.some(pattern => id.match(pattern))) {
        return true
      }
      return isVue(id)
    },
    transform (code, id) {
      if (!CLIENT_FALLBACK_RE.test(code)) { return }

      const s = new MagicString(code)
      const relativeID = isAbsolute(id) ? relative(options.rootDir, id) : id
      let count = 0

      s.replace(CLIENT_FALLBACK_GLOBAL_RE, (full, name, attrs) => {
        count++
        if (/ :?uid=/g.test(attrs)) { return full }
        return `<${name} :uid="'${hash(relativeID)}' + JSON.stringify($props) + '${count}'"  ${attrs ?? ''}>`
      })

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})
