import { renderSSRHead } from '@unhead/vue/server'

const EARLY_HINT_RELS = new Set(['dns-prefetch', 'modulepreload', 'preconnect', 'prefetch', 'preload'])

export async function renderEarlyHintsFromAppHead (head: Parameters<typeof renderSSRHead>[0], renderSSRHeadOptions?: Parameters<typeof renderSSRHead>[1]) {
  const { headTags } = await renderSSRHead(head, renderSSRHeadOptions)
  return renderEarlyHintsFromHeadTags(headTags)
}

export function renderEarlyHintsFromHeadTags (headTags: string) {
  const hints: string[] = []
  for (const attrs of extractLinkTagAttributes(headTags)) {
    const rel = attrs.rel?.trim().toLowerCase()
    if (!rel || !EARLY_HINT_RELS.has(rel) || !attrs.href) {
      continue
    }

    const params = [`<${attrs.href}>`, `rel=${rel}`]
    for (const key of ['as', 'crossorigin', 'fetchpriority', 'imagesizes', 'imagesrcset', 'integrity', 'media', 'referrerpolicy', 'type'] as const) {
      const value = attrs[key]
      if (value === undefined) {
        continue
      }
      params.push(value === '' ? key : `${key}="${value}"`)
    }
    hints.push(params.join('; '))
  }
  return hints
}

export function extractLinkTagAttributes (html: string) {
  const links: Record<string, string>[] = []
  for (const match of html.matchAll(/<link\b([^>]*)>/g)) {
    const attrs: Record<string, string> = {}
    for (const [, key, value1, value2, value3] of match[1]!.matchAll(/\s+([^\s=/>]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      attrs[key.toLowerCase()] = value1 ?? value2 ?? value3 ?? ''
    }
    links.push(attrs)
  }
  return links
}
