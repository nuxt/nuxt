import type { Style } from '@unhead/vue/types'
import { getSSRStyles } from './build-files'

export async function renderInlineStyles (usedModules: Set<string> | string[]): Promise<Style[]> {
  const styleMap = await getSSRStyles()
  const inlinedStyles = new Set<string>()
  // each entry dynamically imports a style chunk: load them concurrently
  // (order is preserved by Promise.all so deduplication stays deterministic)
  const promises: Promise<string[]>[] = []
  for (const mod of usedModules) {
    if (mod in styleMap && styleMap[mod]) {
      promises.push(styleMap[mod]())
    }
  }
  for (const styles of await Promise.all(promises)) {
    for (const style of styles) {
      inlinedStyles.add(style)
    }
  }
  return Array.from(inlinedStyles).map(style => ({ innerHTML: style }))
}
