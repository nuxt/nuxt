import type { Plugin, Rollup } from 'vite'
import { joinURL, withoutLeadingSlash } from 'ufo'
import { normalize } from 'pathe'
import type { Nuxt, NuxtPage } from '@nuxt/schema'

/**
 * Emits `route-styles.json` into the client build assets, mapping each layout
 * name and page (route name) to the basenames of the CSS assets owned by its
 * chunk graph, excluding CSS also owned by an entry chunk (which is always
 * active and never cleaned up). Consumed by `cleanup-route-styles.client` to
 * know which stylesheets belong to a page/layout that is no longer rendered
 * after a client-side navigation (#22817).
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
          chunksByFacade.set(normalize(chunk.facadeModuleId.replace(/\?.+$/, '')), chunk)
        }
      }

      // CSS owned by a chunk = its own emitted CSS plus that of its static import
      // graph - the same set vite's dynamic-import helper injects the first time
      // the chunk is loaded.
      const collectCss = (chunk: Rollup.OutputChunk, css = new Set<string>(), seen = new Set<string>()): Set<string> => {
        if (seen.has(chunk.fileName)) { return css }
        seen.add(chunk.fileName)
        for (const file of chunk.viteMetadata?.importedCss || []) {
          css.add(file.split('/').pop()!)
        }
        for (const imported of chunk.imports) {
          const importedChunk = chunksByFileName.get(imported)
          if (importedChunk) { collectCss(importedChunk, css, seen) }
        }
        return css
      }

      const entryCss = new Set<string>()
      for (const chunk of chunks) {
        if (chunk.isEntry) { collectCss(chunk, entryCss) }
      }

      const cssOwnedByFile = (file?: string | null) => {
        const chunk = file && chunksByFacade.get(normalize(file))
        if (!chunk) { return }
        const css = [...collectCss(chunk)].filter(name => !entryCss.has(name))
        return css.length ? css : undefined
      }

      const layouts: Record<string, string[]> = {}
      for (const layout of Object.values(nuxt.apps.default?.layouts || {})) {
        const css = cssOwnedByFile(layout.file)
        if (css) { layouts[layout.name] = css }
      }

      const flattenPages = (pages?: NuxtPage[]): NuxtPage[] => pages?.flatMap(p => [p, ...flattenPages(p.children)]) ?? []
      const pages: Record<string, string[]> = {}
      for (const page of flattenPages(nuxt.apps.default?.pages)) {
        // routes without a generated name (e.g. parents of nested routes) are
        // left unmanaged - their styles are simply never cleaned up
        if (!page.name) { continue }
        const css = cssOwnedByFile(page.file)
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
