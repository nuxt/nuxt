const EARLY_HINT_RELS = new Set(['dns-prefetch', 'modulepreload', 'preconnect', 'prefetch', 'preload'])

const EARLY_HINT_LINK_ATTRS = ['as', 'crossorigin', 'fetchpriority', 'imagesizes', 'imagesrcset', 'integrity', 'media', 'referrerpolicy', 'type'] as const

/**
 * Convert structured link entries (e.g. from `appHead.link`) to early hint Link headers.
 */
export function renderEarlyHintsFromLinks (links: Record<string, string | undefined>[]): string[] {
  const hints: string[] = []
  for (const link of links) {
    const rel = link.rel?.trim().toLowerCase()
    if (!rel || !EARLY_HINT_RELS.has(rel) || !link.href) {
      continue
    }

    const params = [`<${link.href}>`, `rel=${rel}`]
    for (const key of EARLY_HINT_LINK_ATTRS) {
      const value = link[key]
      if (value === undefined) {
        continue
      }
      params.push(value === '' ? key : `${key}="${value}"`)
    }
    hints.push(params.join('; '))
  }
  return hints
}
