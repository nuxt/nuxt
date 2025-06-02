import type { InlinePreset } from 'unimport'
import { defineUnimportPreset } from 'unimport'

const commonPresets: InlinePreset[] = [
  // vue-demi (mocked)
  defineUnimportPreset({
    from: 'vue-demi',
    imports: [
      'isVue2',
      'isVue3',
    ],
  }),
]

const granularAppPresets: InlinePreset[] = [
  {
    from: '#app/components/nuxt-link',
    imports: ['defineNuxtLink'],
  },
  {
    imports: ['useNuxtApp', 'tryUseNuxtApp', 'defineNuxtPlugin', 'definePayloadPlugin', 'useRuntimeConfig', 'defineAppConfig'],
    from: '#app/nuxt',
  },
  {
    imports: ['useAppConfig', 'updateAppConfig'],
    from: '#app/config',
  },
  {
    imports: ['defineNuxtComponent'],
    from: '#app/composables/component',
  },
  {
    imports: ['useAsyncData', 'useLazyAsyncData', 'useNuxtData', 'refreshNuxtData', 'clearNuxtData'],
    from: '#app/composables/asyncData',
  },
  {
    imports: ['useHydration'],
    from: '#app/composables/hydrate',
  },
  {
    imports: ['callOnce'],
    from: '#app/composables/once',
  },
  {
    imports: ['useState', 'clearNuxtState'],
    from: '#app/composables/state',
  },
  {
    imports: ['clearError', 'createError', 'isNuxtError', 'showError', 'useError'],
    from: '#app/composables/error',
  },
  {
    imports: ['useFetch', 'useLazyFetch'],
    from: '#app/composables/fetch',
  },
  {
    imports: ['useCookie', 'refreshCookie'],
    from: '#app/composables/cookie',
  },
  {
    imports: ['onPrehydrate', 'prerenderRoutes', 'useRequestHeader', 'useRequestHeaders', 'useResponseHeader', 'useRequestEvent', 'useRequestFetch', 'setResponseStatus'],
    from: '#app/composables/ssr',
  },
  {
    imports: ['onNuxtReady'],
    from: '#app/composables/ready',
  },
  {
    imports: ['preloadComponents', 'prefetchComponents', 'preloadRouteComponents'],
    from: '#app/composables/preload',
  },
  {
    imports: ['abortNavigation', 'addRouteMiddleware', 'defineNuxtRouteMiddleware', 'setPageLayout', 'navigateTo', 'useRoute', 'useRouter'],
    from: '#app/composables/router',
  },
  {
    imports: ['isPrerendered', 'loadPayload', 'preloadPayload', 'definePayloadReducer', 'definePayloadReviver'],
    from: '#app/composables/payload',
  },
  {
    imports: ['useLoadingIndicator'],
    from: '#app/composables/loading-indicator',
  },
  {
    imports: ['getAppManifest', 'getRouteRules'],
    from: '#app/composables/manifest',
  },
  {
    imports: ['reloadNuxtApp'],
    from: '#app/composables/chunk',
  },
  {
    imports: ['useRequestURL'],
    from: '#app/composables/url',
  },
  {
    imports: ['usePreviewMode'],
    from: '#app/composables/preview',
  },
  {
    imports: ['useRouteAnnouncer'],
    from: '#app/composables/route-announcer',
  },
  {
    imports: ['useRuntimeHook'],
    from: '#app/composables/runtime-hook',
  },
  {
    imports: ['useHead', 'useHeadSafe', 'useServerHeadSafe', 'useServerHead', 'useSeoMeta', 'useServerSeoMeta', 'injectHead'],
    from: '#app/composables/head',
  },
]

export const scriptsStubsPreset = {
  imports: [
    'useScriptTriggerConsent',
    'useScriptEventPage',
    'useScriptTriggerElement',
    'useScript',
    'useScriptGoogleAnalytics',
    'useScriptPlausibleAnalytics',
    'useScriptCrisp',
    'useScriptClarity',
    'useScriptCloudflareWebAnalytics',
    'useScriptFathomAnalytics',
    'useScriptMatomoAnalytics',
    'useScriptGoogleTagManager',
    'useScriptGoogleAdsense',
    'useScriptSegment',
    'useScriptMetaPixel',
    'useScriptXPixel',
    'useScriptIntercom',
    'useScriptHotjar',
    'useScriptStripe',
    'useScriptLemonSqueezy',
    'useScriptVimeoPlayer',
    'useScriptYouTubePlayer',
    'useScriptGoogleMaps',
    'useScriptNpm',
    'useScriptUmamiAnalytics',
    'useScriptSnapchatPixel',
    'useScriptRybbitAnalytics',
  ],
  priority: -1,
  from: '#app/composables/script-stubs',
} satisfies InlinePreset

// This is a separate preset as we'll swap these out for import from `vue-router` itself in `pages` module
const routerPreset = defineUnimportPreset({
  imports: ['onBeforeRouteLeave', 'onBeforeRouteUpdate'],
  from: '#app/composables/router',
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
    'mergeModels',
    'toValue',
    'useModel',
    'useAttrs',
    'useCssModule',
    'useCssVars',
    'useSlots',
    'useTransitionState',
    'useId',
    'useTemplateRef',
    'useShadowRoot',
    'useCssVars',
  ],
})

const vueTypesPreset = defineUnimportPreset({
  from: 'vue',
  type: true,
  imports: [
    'Component',
    'ComponentPublicInstance',
    'ComputedRef',
    'DirectiveBinding',
    'ExtractDefaultPropTypes',
    'ExtractPropTypes',
    'ExtractPublicPropTypes',
    'InjectionKey',
    'PropType',
    'Ref',
    'MaybeRef',
    'MaybeRefOrGetter',
    'VNode',
    'WritableComputedRef',
  ],
})

export const appCompatPresets: InlinePreset[] = [
  {
    imports: ['requestIdleCallback', 'cancelIdleCallback'],
    from: '#app/compat/idle-callback',
  },
  {
    imports: ['setInterval'],
    from: '#app/compat/interval',
  },
]

export const defaultPresets: InlinePreset[] = [
  ...commonPresets,
  ...granularAppPresets,
  routerPreset,
  vuePreset,
  vueTypesPreset,
]
