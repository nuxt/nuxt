const LANG_MARKER_RE = /([?&])lang\.[^&?]+$/

/**
 * Add the `inline&used` params used to extract a module's CSS for SSR inlining.
 *
 * Vite/plugin-vue keep the `lang.<ext>` marker last so the id ends in a CSS
 * extension, which is what vite's `isCSSRequest` and user plugins gate on.
 * Insert the params *before* that trailing marker so the id keeps its CSS
 * suffix and stays visible to extension-gated transforms. (#29232)
 */
export function withInlineQuery (id: string): string {
  const match = id.match(LANG_MARKER_RE)
  if (match) {
    return id.slice(0, match.index) + match[1] + 'inline&used&' + id.slice(match.index! + 1)
  }
  return id + (id.includes('?') ? '&' : '?') + 'inline&used'
}

const INLINE_STYLE_ID_RE = /[?&]inline&used(?:&|$)/

/**
 * Whether an id was created by {@link withInlineQuery}, i.e. it is a CSS module
 * whose contents are inlined into the server-rendered response.
 */
export function isInlineStyleId (id: string | null | undefined): boolean {
  return !!id && INLINE_STYLE_ID_RE.test(id)
}
