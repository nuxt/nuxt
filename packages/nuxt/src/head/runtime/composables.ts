import type { MetaObject } from '@nuxt/schema'
import type { MaybeComputedRef } from '@vueuse/head'
import { useNuxtApp } from '#app'

/**
 * You can pass in a meta object, which has keys corresponding to meta tags:
 * `title`, `base`, `script`, `style`, `meta` and `link`, as well as `htmlAttrs` and `bodyAttrs`.
 *
 * Alternatively, for reactive meta state, you can pass in a function
 * that returns a meta object.
 */
export function useHead (meta: MaybeComputedRef<MetaObject>) {
  useNuxtApp()._useHead(meta)
}
