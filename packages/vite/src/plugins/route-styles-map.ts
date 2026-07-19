import type { Plugin, Rollup } from 'vite'
import { joinURL, withoutLeadingSlash } from 'ufo'
import { normalize } from 'pathe'
import type { Nuxt, NuxtPage } from '@nuxt/schema'

const QUERY_RE = /\?.+$/

/**
 * Emits `<buildAssetsDir>/route-styles.json`, mapping each layout name and page
 * (route name) to the basenames of the CSS assets its chunk graph owns, excluding
 * CSS also owned by the entry. Used by the `cleanup-route-styles.client` plugin to
 * disable stylesheets of unmounted routes after navigation.
 */
export function RouteStylesMapPlugin (nuxt: Nuxt): Plugin | undefined {
  if (nuxt.options.dev || !nuxt.options.experimental.cleanupRouteStyles) { return }

  return {
    name: 'nuxt:route-styles-map',
    applyToEnvironment: environment => environment.name === 'client',
    generateBundle (_options, bundle) {
      const chunks = Object.values(bundle).filter((c): c is Rollup.OutputChunk => c.type === 'chunk')
      const chunksByFileName = new Map(chunks.map(c => [c.fileName, c]))
      const chunksByFacade = new Map<string, Rollup.OutputChunk>()
      for (const chunk of chunks) {
        if (chunk.facadeModuleId) {
          chunksByFacade.set(normalize(chunk.facadeModuleId.replace(QUERY_RE, '')), chunk)
        }
      }

      // CSS owned by a chunk = its own emitted CSS + that of its static import graph,
      // mirroring the set vite's preload helper injects when the chunk is loaded.
      const cssCache = new Map<string, Set<string>>()
      const collectCss = (chunk: Rollup.OutputChunk, seen = new Set<string>()): Set<string> => {
        const cached = cssCache.get(chunk.fileName)
        if (cached) { return cached }
        seen.add(chunk.fileName)
        const css = new Set<string>()
        for (const file of chunk.viteMetadata?.importedCss || []) {
          css.add(file.split('/').pop()!)
        }
        for (const imported of chunk.imports) {
          const importedChunk = chunksByFileName.get(imported)
          if (importedChunk && !seen.has(imported)) {
            for (const file of collectCss(importedChunk, seen)) {
              css.add(file)
            }
          }
        }
        cssCache.set(chunk.fileName, css)
        return css
      }

      const entryCss = new Set<string>()
      for (const chunk of chunks) {
        if (chunk.isEntry) {
          for (const file of collectCss(chunk)) {
            entryCss.add(file)
          }
        }
      }

      const cssForFile = (file?: string | null) => {
        const chunk = file && chunksByFacade.get(normalize(file))
        if (!chunk) { return }
        const css = [...collectCss(chunk)].filter(file => !entryCss.has(file))
        return css.length ? css : undefined
      }

      const layouts: Record<string, string[]> = {}
      for (const layout of Object.values(nuxt.apps.default?.layouts || {})) {
        const css = cssForFile(layout.file)
        if (css) { layouts[layout.name] = css }
      }

      const pages: Record<string, string[]> = {}
      const flattenPages = (toFlatten?: NuxtPage[]): NuxtPage[] =>
        toFlatten?.flatMap(p => [p, ...flattenPages(p.children)]) ?? []
      for (const page of flattenPages(nuxt.apps.default?.pages)) {
        // ponytail: routes without a generated name (e.g. parents of nested routes)
        // are left unmanaged - their styles are simply never disabled
        if (!page.name) { continue }
        const css = cssForFile(page.file)
        if (css) { pages[page.name] = css }
      }

      this.emitFile({
        type: 'asset',
        fileName: withoutLeadingSlash(joinURL(nuxt.options.app.buildAssetsDir, 'route-styles.json')),
        source: JSON.stringify({ layouts, pages }),
      })
    },
  }
}
