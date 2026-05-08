import type { VueHeadClient } from '@unhead/vue/types'

/**
 * Temporarily disable `head.push` so any `useHead` calls during this window are
 * discarded. Used during the plugin phase of an island request -- entries
 * registered by user plugins belong to the surrounding route, not the island,
 * and including them would leak them into the island response.
 *
 * Returns an `unlock` function that restores the original `push`. The same head
 * instance is kept throughout, so registered head plugins/transformers stay
 * attached. This intentionally avoids mutating any head that could be shared
 * with a concurrent route render (the regression behind #32100, where Vue's
 * module-global `currentInstance` could resolve `injectHead()` to a different
 * request's head and `clear()` would wipe its entries).
 */
export function lockHead (head: VueHeadClient): () => void {
  const realPush = head.push
  head.push = () => ({ dispose: () => {}, patch: () => {}, _poll: () => {} }) as ReturnType<typeof head.push>
  return () => {
    head.push = realPush
  }
}
