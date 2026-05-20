import { hash } from 'ohash'

/**
 * Strip Vue scoped-style attributes (`data-v-*`) from island props before hashing
 * or rendering. Scoped-id markers leak in from parent components and are not part
 * of the logical island input.
 *
 * Used by both `<NuxtIsland>` (client) and the `/__nuxt_island/*` handler (server)
 * to derive the URL-resident `hashId`.
 *
 * @internal
 */
export function filterIslandProps (props: Record<string, any> | null | undefined): Record<string, any> {
  if (!props) { return {} }
  const out: Record<string, any> = {}
  for (const key in props) {
    if (!key.startsWith('data-v-')) {
      out[key] = props[key]
    }
  }
  return out
}

/**
 * Compute the `hashId` segment embedded in an island URL (`/__nuxt_island/<Name>_<hashId>.json`).
 *
 * The hash binds the response to the requested `(name, props, context, source)` tuple,
 * so the server can reject requests whose URL hash does not match the supplied query/body.
 *
 * @internal
 */
export function computeIslandHash (
  name: string,
  filteredProps: Record<string, any>,
  context: Record<string, any>,
  source: string | undefined,
): string {
  return hash([name, filteredProps, context, source]).replace(/[-_]/g, '')
}
