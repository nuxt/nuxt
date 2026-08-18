import type { NuxtSSRContext } from '#app/types'
import { serverDiagnostics } from '../../diagnostics'

const PER_TAG_POSITION = new Set(['meta', 'link', 'style', 'script', 'noscript'])

const isBodyPositioned = (tag: unknown): boolean =>
  Boolean(tag && typeof tag === 'object' && String((tag as { tagPosition?: string }).tagPosition || '').startsWith('body'))

/**
 * Records the kinds of head-positioned tags pending in `head.entries`.
 * Must run before the flush clears the entries.
 */
export function collectStreamedHeadTags (head: NuxtSSRContext['head'], kinds: Set<string>): void {
  for (const entry of head.entries.values()) {
    const options = (entry as { options?: { tagPosition?: string } }).options
    if (options?.tagPosition?.startsWith('body')) { continue }
    const input = entry.input
    if (!input || typeof input !== 'object') { continue }
    for (const key in input as Record<string, unknown>) {
      const value = (input as Record<string, unknown>)[key]
      if (value === undefined) { continue }
      if (PER_TAG_POSITION.has(key)) {
        const tags = Array.isArray(value) ? value : [value]
        if (tags.some(tag => !isBodyPositioned(tag))) { kinds.add(key) }
      } else {
        kinds.add(key)
      }
    }
  }
}

const warnedPaths = new Set<string>()

export function warnStreamedHeadTags (path: string, kinds: Set<string>): void {
  if (!kinds.size || warnedPaths.has(path)) { return }
  warnedPaths.add(path)
  serverDiagnostics.NUXT_E8008({ path, tags: Array.from(kinds).join('`, `') })
}
