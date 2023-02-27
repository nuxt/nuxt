import type { HeadEntryOptions, UseHeadInput, ActiveHeadEntry } from '@unhead/vue'
import { useServerHeadSafe as _useServerHeadSafe, useServerSeoMeta as _useServerSeoMeta, useHead as _useHead, useServerHead as _useServerHead } from '@unhead/vue'
import type { HeadAugmentations } from 'nuxt/schema'

/**
 * You can pass in a meta object, which has keys corresponding to meta tags:
 * `title`, `base`, `script`, `style`, `meta` and `link`, as well as `htmlAttrs` and `bodyAttrs`.
 *
 * Alternatively, for reactive meta state, you can pass in a function
 * that returns a meta object.
 */
export function useHead<T extends HeadAugmentations> (input: UseHeadInput<T>, options?: HeadEntryOptions): ActiveHeadEntry<UseHeadInput<T>> | void {
  return _useHead(input, options)
}

export function useServerHead<T extends HeadAugmentations> (input: UseHeadInput<T>, options?: HeadEntryOptions): ActiveHeadEntry<UseHeadInput<T>> | void {
  if (process.server) {
    return _useServerHead(input, options)
  }
}

export const useServerHeadSafe: typeof _useServerHeadSafe = (input, options) => {
  if (process.server) {
    return _useServerHeadSafe(input, options)
  }
}

/**
 * The `useServerSeoMeta` composable is identical to `useSeoMeta` except that
 * it will have no effect (and will return nothing) if called on the client.
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
