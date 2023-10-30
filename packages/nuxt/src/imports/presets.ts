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

const granularAppPresets: InlinePreset[] = [
  {
    from: '#app/components/nuxt-link',
    imports: ['defineNuxtLink']
  },
  {
    imports: ['useNuxtApp', 'defineNuxtPlugin', 'definePayloadPlugin', 'useRuntimeConfig', 'defineAppConfig'],
    from: '#app/nuxt'
  },
  {
    imports: ['requestIdleCallback', 'cancelIdleCallback'],
    from: '#app/compat/idle-callback'
  },
  {
    imports: ['useAppConfig', 'updateAppConfig'],
    from: '#app/config'
  },
  {
    imports: ['defineNuxtComponent'],
    from: '#app/composables/component'
  },
  {
    imports: ['useAsyncData', 'useLazyAsyncData', 'useNuxtData', 'refreshNuxtData', 'clearNuxtData'],
    from: '#app/composables/asyncData'
  },
  {
    imports: ['useHydration'],
    from: '#app/composables/hydrate'
  },
  {
    imports: ['useState', 'clearNuxtState'],
    from: '#app/composables/state'
  },
  {
    imports: ['clearError', 'createError', 'isNuxtError', 'showError', 'useError'],
    from: '#app/composables/error'
  },
  {
    imports: ['useFetch', 'useLazyFetch'],
    from: '#app/composables/fetch'
  },
  {
    imports: ['useCookie'],
    from: '#app/composables/cookie'
  },
  {
    imports: ['prerenderRoutes', 'useRequestHeaders', 'useRequestEvent', 'useRequestFetch', 'setResponseStatus'],
    from: '#app/composables/ssr'
  },
  {
    imports: ['onNuxtReady'],
    from: '#app/composables/ready'
  },
  {
    imports: ['preloadComponents', 'prefetchComponents', 'preloadRouteComponents'],
    from: '#app/composables/preload'
  },
  {
    imports: ['abortNavigation', 'addRouteMiddleware', 'defineNuxtRouteMiddleware', 'setPageLayout', 'navigateTo', 'useRoute', 'useRouter'],
    from: '#app/composables/router'
  },
  {
    imports: ['isPrerendered', 'loadPayload', 'preloadPayload', 'definePayloadReducer', 'definePayloadReviver'],
    from: '#app/composables/payload'
  },
  {
    imports: ['getAppManifest', 'getRouteRules'],
    from: '#app/composables/manifest'
  },
  {
    imports: ['reloadNuxtApp'],
    from: '#app/composables/chunk'
  },
  {
    imports: ['useRequestURL'],
    from: '#app/composables/url'
  }
]

// This is a separate preset as we'll swap these out for import from `vue-router` itself in `pages` module
const routerPreset = defineUnimportPreset({
  imports: ['onBeforeRouteLeave', 'onBeforeRouteUpdate'],
  from: '#app/composables/router'
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
    'watchPostEffect',
    'watchSyncEffect',
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
    'hasInjectionContext',
    'nextTick',
    'provide',
    'defineModel',
    'defineOptions',
    'defineSlots',
    'mergeModels',
    'toValue',
    'useModel',
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
    'ExtractPropTypes',
    'ExtractPublicPropTypes',
    'InjectionKey',
    'PropType',
    'Ref',
    'MaybeRef',
    'MaybeRefOrGetter',
    'VNode'
  ]
})

export const defaultPresets: InlinePreset[] = [
  ...commonPresets,
  ...granularAppPresets,
  routerPreset,
  vuePreset,
  vueTypesPreset
]
