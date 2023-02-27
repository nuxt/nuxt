import type { HeadEntryOptions, UseHeadInput, ActiveHeadEntry } from '@unhead/vue'
import { useHead as _useHead, useServerHead as _useServerHead } from '@unhead/vue'
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

export {
  useSeoMeta,
  useServerSeoMeta,
  useHeadSafe,
  useServerHeadSafe,
  injectHead
} from '@unhead/vue'
