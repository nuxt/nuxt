const QUERY_RE = /\?.*$/
const LEADING_RELATIVE_RE = /^(?:\.\.?\/)+/

/**
 * Whether a dev stylesheet belongs to one of the modules a render actually used.
 *
 * The dev CSS set is the builder's whole module graph, not a per-request subset, so
 * consumers that must not leak unrelated styles (islands) narrow it with the modules
 * Vue registered during their own render.
 */
export function isStyleOfModule (file: string, modules: Set<string> | string[]): boolean {
  const path = file.replace(QUERY_RE, '')
  for (const mod of modules) {
    const normalized = mod.replace(LEADING_RELATIVE_RE, '')
    if (normalized && (path === normalized || path.endsWith('/' + normalized))) {
      return true
    }
  }
  return false
}
