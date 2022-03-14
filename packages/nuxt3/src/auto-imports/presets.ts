import { defineUnimportPreset } from 'unimport'

export const commonPresets = [
  // #meta
  defineUnimportPreset({
    from: '#meta',
    imports: [
      'useMeta'
    ]
  }),
  // vue-demi (mocked)
  defineUnimportPreset({
    from: 'vue-demi',
    imports: [
      'isVue2',
      'isVue3'
    ]
  })
]

export const appPreset = defineUnimportPreset({
  from: '#app',
  imports: [
    'useAsyncData',
    'useLazyAsyncData',
    'defineNuxtComponent',
    'useNuxtApp',
    'defineNuxtPlugin',
    'useRuntimeConfig',
    'useState',
    'useFetch',
    'useLazyFetch',
    'useCookie',
    'useRequestHeaders',
    'useRouter',
    'useRoute',
    'defineNuxtRouteMiddleware',
    'navigateTo',
    'abortNavigation',
    'addRouteMiddleware',
    'throwError',
    'clearError',
    'useError',
    'defineNuxtLink'
  ]
})

// vue
export const vuePreset = defineUnimportPreset({
  from: 'vue',
  imports: [
    // <script setup>
    'withCtx',
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
    'toRaw',
    'toRef',
    'toRefs',
    'triggerRef',
    'unref',
    'watch',
    'watchEffect',
    'isShallow',

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
})

export const defaultPresets = [
  ...commonPresets,
  appPreset,
  vuePreset
]
