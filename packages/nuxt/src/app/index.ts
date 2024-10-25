export { applyPlugin, applyPlugins, callWithNuxt, createNuxtApp, defineAppConfig, defineNuxtPlugin, definePayloadPlugin, isNuxtPlugin, registerPluginHooks, tryUseNuxtApp, useNuxtApp, useRuntimeConfig } from './nuxt'
export type { CreateOptions, NuxtApp, NuxtPayload, NuxtPluginIndicator, NuxtSSRContext, ObjectPlugin, Plugin, PluginEnvContext, PluginMeta, ResolvedPluginMeta, RuntimeNuxtHooks } from './nuxt'

export { defineNuxtComponent, useAsyncData, useLazyAsyncData, useNuxtData, refreshNuxtData, clearNuxtData, useHydration, callOnce, useState, clearNuxtState, clearError, createError, isNuxtError, showError, useError, useFetch, useLazyFetch, useCookie, refreshCookie, onPrehydrate, prerenderRoutes, useRequestHeaders, useRequestEvent, useRequestFetch, setResponseStatus, useResponseHeader, onNuxtReady, abortNavigation, addRouteMiddleware, defineNuxtRouteMiddleware, onBeforeRouteLeave, onBeforeRouteUpdate, setPageLayout, navigateTo, useRoute, useRouter, preloadComponents, prefetchComponents, preloadRouteComponents, isPrerendered, loadPayload, preloadPayload, definePayloadReducer, definePayloadReviver, getAppManifest, getRouteRules, reloadNuxtApp, useRequestURL, usePreviewMode, useId, useRouteAnnouncer, useHead, useSeoMeta, useServerSeoMeta } from './composables/index'
export type { AddRouteMiddlewareOptions, AsyncData, AsyncDataOptions, AsyncDataRequestStatus, CookieOptions, CookieRef, FetchResult, NuxtAppManifest, NuxtAppManifestMeta, NuxtError, ReloadNuxtAppOptions, RouteMiddleware, UseFetchOptions } from './composables/index'

export { defineNuxtLink } from './components/index'
export type { NuxtLinkOptions, NuxtLinkProps } from './components/index'
export { _getAppConfig, updateAppConfig, useAppConfig } from './config'
export { cancelIdleCallback, requestIdleCallback } from './compat/idle-callback'
export type { NuxtAppLiterals, NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext, PageMeta } from './types'

export const isVue2 = false
export const isVue3 = true
