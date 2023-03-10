import type { InlinePreset } from 'unimport'
import { defineUnimportPreset } from 'unimport'

const commonPresets: InlinePreset[] = [
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
    'useNuxtData',
    'refreshNuxtData',
    'clearNuxtData',
    'defineNuxtComponent',
    'useNuxtApp',
    'defineNuxtPlugin',
    'reloadNuxtApp',
    'useRuntimeConfig',
    'useState',
    'useFetch',
    'useLazyFetch',
    'useCookie',
    'useRequestHeaders',
    'useRequestEvent',
    'useRequestFetch',
    'setResponseStatus',
    'setPageLayout',
    'onNuxtReady',
    'useRouter',
    'useRoute',
    'defineNuxtRouteMiddleware',
    'navigateTo',
    'abortNavigation',
    'addRouteMiddleware',
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
    'preloadRouteComponents',
    'prefetchComponents',
    'loadPayload',
    'preloadPayload',
    'isPrerendered'
  ]
})

// vue-router
const routerPreset = defineUnimportPreset({
  from: '#app',
  imports: [
    'onBeforeRouteLeave',
    'onBeforeRouteUpdate'
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
  ]
})

const vueTypesPreset = defineUnimportPreset({
  from: 'vue',
  type: true,
  imports: [
    'Component',
    'ComponentPublicInstance',
    'ComputedRef',
    'InjectionKey',
    'PropType',
    'Ref',
    'VNode'
  ]
})

export const defaultPresets: InlinePreset[] = [
  ...commonPresets,
  appPreset,
  routerPreset,
  vuePreset,
  vueTypesPreset
]
