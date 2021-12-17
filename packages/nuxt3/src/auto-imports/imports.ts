import type { AutoImportSource } from '@nuxt/schema'

export const Nuxt3AutoImports: AutoImportSource[] = [
  // #app
  {
    from: '#app',
    names: [
      'useAsyncData',
      'useLazyAsyncData',
      'defineNuxtComponent',
      'useNuxtApp',
      'defineNuxtPlugin',
      'useRuntimeConfig',
      'useState',
      'useFetch',
      'useLazyFetch',
      'useCookie'
    ]
  },
  // #meta
  {
    from: '#meta',
    names: [
      'useMeta'
    ]
  },
  // vue-demi (mocked)
  {
    from: 'vue-demi',
    names: [
      'isVue2',
      'isVue3'
    ]
  },
  // vue
  {
    from: 'vue',
    names: [
      // <script setup>
      'defineEmits',
      'defineExpose',
      'defineProps',
      'withCtx',
      'withDefaults',
      'withDirectives',
      'withKeys',
      'withMemo',
      'withModifiers',
      'withScopeId',

      // Lifecycle
      'onActivated',
      'onBeforeMount',
      'onBeforeUnmount',
      'onBeforeUpdate',
      'onDeactivated',
      'onErrorCaptured',
      'onMounted',
      'onRenderTracked',
      'onRenderTriggered',
      'onServerPrefetch',
      'onUnmounted',
      'onUpdated',

      // Reactivity
      'computed',
      'customRef',
      'isProxy',
      'isReactive',
      'isReadonly',
      'isRef',
      'markRaw',
      'proxyRefs',
      'reactive',
      'readonly',
      'ref',
      'shallowReactive',
      'shallowReadonly',
      'shallowRef',
      'stop',
      'toRaw',
      'toRef',
      'toRefs',
      'triggerRef',
      'unref',
      'watch',
      'watchEffect',

      // effect
      'effect',
      'effectScope',
      'getCurrentScope',
      'onScopeDispose',

      // Component
      'defineComponent',
      'defineAsyncComponent',
      'getCurrentInstance',
      'h',
      'inject',
      'nextTick',
      'provide',
      'useAttrs',
      'useCssModule',
      'useCssVars',
      'useSlots',
      'useTransitionState'
    ] as Array<keyof typeof import('vue')>
  }
]
