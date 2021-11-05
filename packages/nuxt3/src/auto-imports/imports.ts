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
      // <script setup>
      'defineEmits',
      'defineExpose',
      'defineProps',
      'withAsyncContext',
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
