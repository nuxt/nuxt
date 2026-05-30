import type { Link } from '@unhead/vue/types'

export type AssetCrossOrigin = '' | 'anonymous' | 'use-credentials'

export function normalizeCrossOrigin (value: unknown): AssetCrossOrigin {
  return value === 'anonymous' || value === 'use-credentials' ? value : ''
}

export function withCrossOrigin<T extends Link> (links: T[], crossOrigin: AssetCrossOrigin): T[] {
  for (const link of links) {
    if (link.crossorigin != null) {
      link.crossorigin = crossOrigin
    }
  }
  return links
}

export function renderCrossOriginAttr (crossOrigin: AssetCrossOrigin): string {
  return crossOrigin ? ` crossorigin="${crossOrigin}"` : ' crossorigin'
}

export function applyCrossOriginToLinkHeader (header: string, crossOrigin: AssetCrossOrigin): string {
  if (!crossOrigin) {
    return header
  }
  return header.replace(/;\s*crossorigin(?:=(?:"[^"]*"|[^,;]+))?/gi, `; crossorigin=${crossOrigin}`)
}
