import type { UseHeadInput } from '@unhead/vue'
import type { HeadAugmentations } from 'nuxt/schema'

/** @deprecated Use `UseHeadInput` from `@unhead/vue` instead. This may be removed in a future minor version. */
export type MetaObject = UseHeadInput<HeadAugmentations>
export {
  /** @deprecated Import `useHead` from `#imports` instead. This may be removed in a future minor version. */
  useHead,
  /** @deprecated Import `useSeoMeta` from `#imports` instead. This may be removed in a future minor version. */
  useSeoMeta,
  /** @deprecated Import `useServerSeoMeta` from `#imports` instead. This may be removed in a future minor version. */
  useServerSeoMeta
} from '@unhead/vue'

export { defineNuxtComponent } from './component'
export { useAsyncData, useLazyAsyncData, useNuxtData, refreshNuxtData, clearNuxtData } from './asyncData'
export type { AsyncDataOptions, AsyncData } from './asyncData'
export { useHydration } from './hydrate'
export { useState, clearNuxtState } from './state'
export { clearError, createError, isNuxtError, showError, useError } from './error'
export type { NuxtError } from './error'
export { useFetch, useLazyFetch } from './fetch'
export type { FetchResult, UseFetchOptions } from './fetch'
export { useCookie } from './cookie'
export type { CookieOptions, CookieRef } from './cookie'
export { prerenderRoutes, useRequestHeaders, useRequestEvent, useRequestFetch, setResponseStatus } from './ssr'
export { onNuxtReady } from './ready'
export { abortNavigation, addRouteMiddleware, defineNuxtRouteMiddleware, onBeforeRouteLeave, onBeforeRouteUpdate, setPageLayout, navigateTo, useRoute, useRouter } from './router'
export type { AddRouteMiddlewareOptions, RouteMiddleware } from './router'
export { preloadComponents, prefetchComponents, preloadRouteComponents } from './preload'
export { isPrerendered, loadPayload, preloadPayload, definePayloadReducer, definePayloadReviver } from './payload'
export { getAppManifest, getRouteRules } from './manifest'
export type { NuxtAppManifest, NuxtAppManifestMeta } from './manifest'
export type { ReloadNuxtAppOptions } from './chunk'
export { reloadNuxtApp } from './chunk'
export { useRequestURL } from './url'
