import type { HeadEntryOptions, UseHeadInput, ActiveHeadEntry } from '@unhead/vue'
import { useServerHeadSafe as _useServerHeadSafe, useServerSeoMeta as _useServerSeoMeta, useHead as _useHead, useServerHead as _useServerHead } from '@unhead/vue'
import type { HeadAugmentations } from 'nuxt/schema'

/**
 * Allows you to manage your head tags in a programmatic and reactive way.
 *
 * @see https://nuxt.com/docs/getting-started/seo-meta
 * @see https://unhead.harlanzw.com/guide/composables/use-head
 */
export function useHead<T extends HeadAugmentations> (input: UseHeadInput<T>, options?: HeadEntryOptions): ActiveHeadEntry<UseHeadInput<T>> | void {
  return _useHead(input, options)
}

/**
 * The `useServerHead` composable is identical to `useHead` except that it will
 * have no effect (and will return nothing) if called on the client.
 *
 * @see useHead
 * @see https://unhead.harlanzw.com/guide/composables/use-server-head
 */
export function useServerHead<T extends HeadAugmentations> (input: UseHeadInput<T>, options?: HeadEntryOptions): ActiveHeadEntry<UseHeadInput<T>> | void {
  if (process.server) {
    return _useServerHead(input, options)
  }
}

/**
 * The `useServerHeadSafe` composable is identical to `useHeadSafe` except that it will
 * have no effect (and will return nothing) if called on the client.
 *
 * @see useHeadSafe
 */
export const useServerHeadSafe: typeof _useServerHeadSafe = (input, options) => {
  if (process.server) {
    return _useServerHeadSafe(input, options)
  }
}

/**
 * The `useServerSeoMeta` composable is identical to `useSeoMeta` except that
 * it will have no effect (and will return nothing) if called on the client.
 *
 * @see useSeoMeta
 * @see https://unhead.harlanzw.com/guide/composables/use-seo-meta
 */
export const useServerSeoMeta: typeof _useServerSeoMeta = (meta) => {
  if (process.server) {
    return _useServerSeoMeta(meta)
  }
}

export {
  useSeoMeta,
  useHeadSafe,
  injectHead
} from '@unhead/vue'
