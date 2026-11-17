import type { Nuxt } from '@nuxt/schema'
import type { PostCSSPlugin } from '@rsbuild/core'
import { resolveAlias } from '@nuxt/kit'
import { dirname, relative } from 'pathe'

const TILDE_URL_RE = /url\(\s*(["']?)(~~?\/[^"')\s]+)\1\s*\)/g

/**
 * Rewrite `url()` requests starting with the `~` and `~~` aliases into paths relative to the
 * stylesheet, as css-loader does not resolve them with the aliases of the project.
 */
export function TildeAliasPostcssPlugin (nuxt: Nuxt): PostCSSPlugin {
  return {
    postcssPlugin: 'nuxt:tilde-alias',
    Declaration (decl) {
      const file = decl.source?.input.file
      if (!file || !decl.value.includes('url(')) {
        return
      }
      decl.value = decl.value.replace(TILDE_URL_RE, (_, quote: string, url: string) => {
        const path = relative(dirname(file), resolveAlias(url, nuxt.options.alias))
        return `url(${quote}${path[0] === '.' ? path : `./${path}`}${quote})`
      })
    },
  }
}
