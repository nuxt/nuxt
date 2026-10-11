import { getInlinedCSS } from './build-files'

/**
 * Build a predicate telling whether the contents of an emitted CSS file were
 * inlined as `<style>` tags for this request, meaning its `<link>` can be
 * dropped.
 *
 * The builder can only remove a link at build time when every CSS source in
 * the file is inlined for a module that is always rendered. For the rest it
 * records the modules that inline each source, and the answer depends on what
 * the request actually rendered: a component inside `<ClientOnly>` never
 * reaches `ssrContext.modules`, so its styles are only ever delivered by the
 * link. (#36058)
 */
export async function createInlinedCSSFilter (modules: Set<string> | undefined): Promise<(file: string) => boolean> {
  const inlinedCSS = await getInlinedCSS()
  return (file) => {
    const conditions = inlinedCSS[file.slice(file.lastIndexOf('/') + 1)]
    if (!conditions) { return false }
    if (!modules?.size) { return false }
    for (const inliners of conditions) {
      let inlined = false
      for (const id of inliners) {
        if (modules.has(id)) {
          inlined = true
          break
        }
      }
      if (!inlined) { return false }
    }
    return true
  }
}
