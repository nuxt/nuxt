// import { useMeta as useVueMeta } from 'vue-meta'
import { isFunction } from '@vue/shared'
import { computed, ComputedGetter } from '@vue/reactivity'
import { useHead } from '@vueuse/head'

/**
 * You can pass in a meta object, which has keys corresponding to meta tags:
 * `title`, `base`, `script`, `style`, `meta` and `link`, as well as `htmlAttrs` and `bodyAttrs`.
 *
 * Alternatively, for reactive meta state, you can pass in a function
 * that returns a meta object.
 */
export function useMeta (meta: Record<string, any> | ComputedGetter<any>) {
  // TODO: refine @nuxt/meta API

  // At the moment we force all interaction to happen through passing in
  // the meta object or function that returns a meta object.
  const source = isFunction(meta) ? computed(meta) : meta

  // `vue-meta`
  // useVueMeta(source)

  // `@vueuse/head`
  useHead(source)
}
