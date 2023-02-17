import type { HeadEntryOptions, UseHeadInput, ActiveHeadEntry } from '@vueuse/head'
import { useSeoMeta as _useSeoMeta } from '@vueuse/head'
import type { HeadAugmentations } from 'nuxt/schema'
import { useNuxtApp } from '#app/nuxt'

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

/**
 * The `useSeoMeta` composable lets you define your site's SEO meta tags
 * as a flat object with full TypeScript support.
 *
 * This helps you avoid typos and common mistakes, such as using `name`
 * instead of `property`.
 *
 * It is advised to use `useServerSeoMeta` unless you _need_ client-side
 * rendering of your SEO meta tags.
 */
export const useSeoMeta: typeof _useSeoMeta = (meta) => {
  return _useSeoMeta(meta)
}

/**
 * The `useServerSeoMeta` composable is identical to `useSeoMeta` except that
 * it will have no effect (and will return nothing) if called on the client.
 */
export const useServerSeoMeta: typeof _useSeoMeta = (meta) => {
  if (process.server) {
    return _useSeoMeta(meta)
  }
}
