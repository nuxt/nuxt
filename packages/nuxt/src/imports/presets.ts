import { defineUnimportPreset, Preset } from 'unimport'

const commonPresets: Preset[] = [
  // #head
  defineUnimportPreset({
    from: '#head',
    imports: [
      'useHead',
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

const appPreset = defineUnimportPreset({
  from: '#app',
  imports: [
    'useAsyncData',
    'useLazyAsyncData',
    'refreshNuxtData',
    'defineNuxtComponent',
    'useNuxtApp',
    'defineNuxtPlugin',
    'useRuntimeConfig',
    'useState',
    'useFetch',
    'useLazyFetch',
    'useCookie',
    'useRequestHeaders',
    'useRequestEvent',
    'setResponseStatus',
    'useRouter',
    'useRoute',
    'useActiveRoute',
    'defineNuxtRouteMiddleware',
    'navigateTo',
    'abortNavigation',
    'addRouteMiddleware',
    'throwError',
    'showError',
    'clearError',
    'isNuxtError',
    'useError',
    'createError',
    'defineNuxtLink',
    'useAppConfig',
    'updateAppConfig',
    'defineAppConfig',
    'preloadComponents',
    'prefetchComponents'
  ]
})

// vue
const vuePreset = defineUnimportPreset({
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
    'resolveComponent',
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
