import type { AutoImportSource } from '@nuxt/kit'

export const Nuxt3AutoImports: AutoImportSource[] = [
  // #app
  {
    from: '#app',
    names: [
      'useAsyncData',
      'defineNuxtComponent',
      'useNuxtApp',
      'defineNuxtPlugin',
      'useRuntimeConfig',
      'useState',
      'useFetch'
    ]
  },
  // #meta
  {
    from: '#meta',
    names: [
      'useMeta'
    ]
  },
  // vue-router
  {
    from: 'vue-router',
    names: [
      'useRoute',
      'useRouter'
    ]
  },
  // vue
  {
    from: 'vue',
    names: [
      // Lifecycle
      'onActivated',
      'onBeforeMount',
      'onBeforeUnmount',
      'onBeforeUpdate',
      'onDeactivated',
      'onErrorCaptured',
      'onMounted',
      'onServerPrefetch',
      'onUnmounted',
      'onUpdated',

      // Reactivity
      'computed',
      'customRef',
      'isReadonly',
      'isRef',
      'markRaw',
      'reactive',
      'readonly',
      'ref',
      'shallowReactive',
      'shallowReadonly',
      'shallowRef',
      'toRaw',
      'toRef',
      'toRefs',
      'triggerRef',
      'unref',
      'watch',
      'watchEffect',

      // Component
      'defineComponent',
      'defineAsyncComponent',
      'getCurrentInstance',
      'h',
      'inject',
      'nextTick',
      'provide',
      'useCssModule'
    ]
  }
]
