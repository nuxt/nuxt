import { isFunction } from '@vue/shared'
import { computed } from 'vue'
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
export function useHead (meta: MetaObject | ComputedGetter<MetaObject>) {
  const resolvedMeta = isFunction(meta) ? computed(meta) : meta
  useNuxtApp()._useHead(resolvedMeta)
}

const _warned = {}
const warnOnce = (id: string, message: string) => {
  if (!_warned[id]) {
    console.warn(message)
    _warned[id] = true
  }
}
// TODO: remove useMeta support when Nuxt 3 is stable
/** @deprecated */
export function useMeta (meta: MetaObject | ComputedGetter<MetaObject>) {
  warnOnce('useMeta', '[meta] useMeta has been renamed to useHead.')
  return useHead(meta)
}
