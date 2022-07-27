import { isFunction } from '@vue/shared'
import { computed } from 'vue'
import type { ComputedGetter, ComputedRef } from '@vue/reactivity'
import type { MetaObject } from '@nuxt/schema'
import { useNuxtApp } from '#app'

type Computable<T> = T extends Record<string, any> ? ComputedGetter<T> | { [K in keyof T]: T[K] | ComputedRef<T[K]> } : T

/**
 * You can pass in a meta object, which has keys corresponding to meta tags:
 * `title`, `base`, `script`, `style`, `meta` and `link`, as well as `htmlAttrs` and `bodyAttrs`.
 *
 * Alternatively, for reactive meta state, you can pass in a function
 * that returns a meta object.
 */
export function useHead (meta: Computable<MetaObject>) {
  const resolvedMeta = isFunction(meta) ? computed(meta) : meta
  useNuxtApp()._useHead(resolvedMeta)
}

// TODO: remove useMeta support when Nuxt 3 is stable
/** @deprecated Please use new `useHead` composable instead */
export function useMeta (meta: Computable<MetaObject>) {
  return useHead(meta)
}
