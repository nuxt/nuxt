import { isAbsolute } from 'pathe'
import { directoryToURL, resolveAlias } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'
import { getQuery } from 'ufo'
import type { EnvironmentModuleGraph } from 'vite'

import { isCSS } from './index.ts'

/**
 * Convert an absolute file path to the dev-server URL Vite serves it from.
 */
function toFsUrl (path: string): string {
  return '/@fs' + path.replace(/^(?!\/)/, '/')
}

/**
 * Resolve the global CSS entries from `nuxt.options.css` to `/@fs/...`
 * dev-server URLs, paired with the absolute path they resolved to.
 *
 * Used to seed the dev SSR client manifest so globally-registered styles are
 * always inlined, even before the ssr module graph has loaded the component
 * that imports them.
 */
export function resolveGlobalCss (nuxt: Nuxt): Array<{ file: string, url: string }> {
  const out = new Map<string, string>()
  for (const entry of nuxt.options.css) {
    if (typeof entry !== 'string') { continue }
    const resolved = resolveAlias(entry, nuxt.options.alias)
    if (isAbsolute(resolved)) {
      out.set(resolved, toFsUrl(resolved))
      continue
    }
    const fromModules = resolveModulePath(resolved, {
      try: true,
      from: nuxt.options.modulesDir.map(d => directoryToURL(d)),
    })
    if (fromModules) {
      out.set(fromModules, toFsUrl(fromModules))
    }
  }
  return Array.from(out, ([file, url]) => ({ file, url }))
}

export function collectGlobalCss (nuxt: Nuxt): string[] {
  return resolveGlobalCss(nuxt).map(entry => entry.url)
}

/**
 * Union of the CSS the ssr module graph has loaded and the globally-registered
 * CSS, with global entries the graph already covers dropped: the graph url and
 * the `/@fs/...` url for the same file are different strings that would
 * otherwise both be emitted as `<link>` tags.
 */
export function collectDevCss (nuxt: Nuxt, moduleGraph: EnvironmentModuleGraph): string[] {
  const urls = new Set<string>()
  const files = new Set<string>()
  for (const [url, node] of moduleGraph.urlToModuleMap.entries()) {
    if (!isCSS(url) || 'raw' in getQuery(url)) { continue }
    const importers = node.importers
    if (importers?.size && [...importers].every(i => i.id && 'raw' in getQuery(i.id))) { continue }
    urls.add(url)
    if (node.file) { files.add(node.file) }
  }

  for (const entry of resolveGlobalCss(nuxt)) {
    if (!files.has(entry.file)) { urls.add(entry.url) }
  }

  return [...urls]
}
