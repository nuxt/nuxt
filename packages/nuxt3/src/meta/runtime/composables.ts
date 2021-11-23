import { isFunction } from '@vue/shared'
import { computed } from '@vue/reactivity'
import type { ComputedGetter } from '@vue/reactivity'
import type { MetaObject } from '@nuxt/schema'
import { useNuxtApp } from '#app'

/**
 * You can pass in a meta object, which has keys corresponding to meta tags:
 * `title`, `base`, `script`, `style`, `meta` and `link`, as well as `htmlAttrs` and `bodyAttrs`.
 *
 * Alternatively, for reactive meta state, you can pass in a function
 * that returns a meta object.
 */
export function useMeta (meta: MetaObject | ComputedGetter<MetaObject>) {
  const resolvedMeta = isFunction(meta) ? computed(meta) : meta
  useNuxtApp()._useMeta(resolvedMeta)
}
