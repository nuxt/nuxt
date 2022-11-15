import type { HeadEntryOptions, UseHeadInput, ActiveHeadEntry } from '@vueuse/head'
import type { HeadAugmentations } from '@nuxt/schema'
import { useNuxtApp } from '#app'

/**
 * You can pass in a meta object, which has keys corresponding to meta tags:
 * `title`, `base`, `script`, `style`, `meta` and `link`, as well as `htmlAttrs` and `bodyAttrs`.
 *
 * Alternatively, for reactive meta state, you can pass in a function
 * that returns a meta object.
 */
export function useHead<T extends HeadAugmentations> (input: UseHeadInput<T>, options?: HeadEntryOptions): ActiveHeadEntry<UseHeadInput<T>> | void {
  return useNuxtApp()._useHead(input, options)
}
