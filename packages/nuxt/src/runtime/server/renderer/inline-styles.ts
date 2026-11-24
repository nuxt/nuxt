import type { Style } from '@unhead/vue/types'
import { getSSRStyles } from './build-files'

export async function renderInlineStyles (usedModules: Set<string> | string[]): Promise<Style[]> {
  const [, styles] = await renderSplitInlineStyles(usedModules, [])
  return styles
}

type StyleLoader = () => Promise<string[]>

const loadedStyles = new WeakMap<StyleLoader, string[]>()

function loadStyles (loader: StyleLoader): string[] | Promise<string[]> {
  if (import.meta.dev) {
    return loader()
  }
  return loadedStyles.get(loader) ?? loader().then((styles) => {
    loadedStyles.set(loader, styles)
    return styles
  })
}

export async function renderSplitInlineStyles (usedModules: Set<string> | string[], entryModules: string[]): Promise<[entry: Style[], rest: Style[]]> {
  const styleMap = await getSSRStyles()
  const entry = new Set(entryModules)
  const pending: Array<[isEntry: boolean, styles: string[]] | Promise<[isEntry: boolean, styles: string[]]>> = []
  for (const mod of usedModules) {
    if (mod in styleMap && styleMap[mod]) {
      const styles = loadStyles(styleMap[mod])
      pending.push(Array.isArray(styles) ? [entry.has(mod), styles] : styles.then(styles => [entry.has(mod), styles]))
    }
  }
  const results = await Promise.all(pending)
  const entryStyles = new Set(results.flatMap(([isEntry, styles]) => isEntry ? styles : []))
  const restStyles = new Set(results.flatMap(([isEntry, styles]) => isEntry ? [] : styles.filter(style => !entryStyles.has(style))))
  return [toStyles(entryStyles), toStyles(restStyles)]
}

function toStyles (styles: Set<string>): Style[] {
  return Array.from(styles).map(style => ({ innerHTML: style }))
}
