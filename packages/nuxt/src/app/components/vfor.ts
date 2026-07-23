/**
 * Upper bound on `v-for` iterations expanded server-side in a server component or island.
 * Island props are attacker-controllable, so a large numeric `v-for` source is a
 * memory-amplification vector; this caps it.
 *
 * @internal
 */
export const MAX_VFOR_LENGTH = 10_000

/**
 * Clamp a numeric `v-for` source before iteration. Only numbers are bounded (the
 * amplification vector); other sources are returned unchanged.
 *
 * @internal
 */
export function vforBound<T> (source: T): T | number {
  if (typeof source !== 'number' || source <= MAX_VFOR_LENGTH) {
    return source
  }
  if (import.meta.dev) {
    console.warn(`A v-for in a server component asked for ${source} iterations; only the first ${MAX_VFOR_LENGTH} were rendered. Island props come from the request, so the count is capped. Paginate the data, or clamp the value before passing it to the island.`)
  }
  return MAX_VFOR_LENGTH
}
