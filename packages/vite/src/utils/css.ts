import { isAbsolute } from 'pathe'
import { directoryToURL, resolveAlias } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'

/**
 * Resolve the global CSS entries from `nuxt.options.css` to dev-server URLs
 * (`/@fs/...` for files outside the root, absolute paths otherwise).
 *
 * Used to seed the dev SSR client manifest so globally-registered styles are
 * always inlined, even before the ssr module graph has loaded the component
 * that imports them.
 */
export function collectGlobalCss (nuxt: Nuxt): string[] {
  const out: string[] = []
  for (const entry of nuxt.options.css) {
    if (typeof entry !== 'string') { continue }
    const resolved = resolveAlias(entry, nuxt.options.alias)
    if (isAbsolute(resolved)) {
      out.push(resolved)
      continue
    }
    const fromModules = resolveModulePath(resolved, {
      try: true,
      from: nuxt.options.modulesDir.map(d => directoryToURL(d)),
    })
    if (fromModules) {
      out.push('/@fs' + fromModules.replace(/^(?!\/)/, '/'))
    }
  }
  return out
}
