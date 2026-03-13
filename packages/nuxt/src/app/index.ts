import '../../dist/app/types/augments'

export { applyPlugin, applyPlugins, callWithNuxt, createNuxtApp, defineAppConfig, defineNuxtPlugin, definePayloadPlugin, isNuxtPlugin, registerPluginHooks, tryUseNuxtApp, useNuxtApp, useRuntimeConfig } from './nuxt'
export type { CreateOptions, NuxtApp, NuxtPayload, NuxtPluginIndicator, NuxtSSRContext, ObjectPlugin, Plugin, PluginEnvContext, PluginMeta, ResolvedPluginMeta, RuntimeNuxtHooks } from './nuxt'

// eslint-disable-next-line @typescript-eslint/no-deprecated
export { defineNuxtComponent, useAsyncData, useLazyAsyncData, useNuxtData, refreshNuxtData, clearNuxtData, useHydration, callOnce, useState, clearNuxtState, clearError, createError, isNuxtError, showError, useError, useFetch, useLazyFetch, useCookie, refreshCookie, onPrehydrate, prerenderRoutes, useRequestHeaders, useRequestEvent, useRequestFetch, setResponseStatus, useResponseHeader, onNuxtReady, abortNavigation, addRouteMiddleware, defineNuxtRouteMiddleware, onBeforeRouteLeave, onBeforeRouteUpdate, setPageLayout, navigateTo, useRoute, useRouter, preloadComponents, prefetchComponents, preloadRouteComponents, isPrerendered, loadPayload, preloadPayload, definePayloadReducer, definePayloadReviver, getAppManifest, getRouteRules, reloadNuxtApp, useRequestURL, usePreviewMode, useId, useRouteAnnouncer, useAnnouncer, useHead, useHeadSafe, useServerSeoMeta, useServerHeadSafe, useServerHead, useSeoMeta, injectHead, useRuntimeHook } from './composables/index'
export type { AddRouteMiddlewareOptions, AnnouncerPoliteness, AsyncData, AsyncDataOptions, AsyncDataRequestStatus, CookieOptions, CookieRef, FetchResult, NuxtAnnouncer, NuxtAnnouncerOpts, NuxtAppManifest, NuxtAppManifestMeta, NuxtError, Politeness, ReloadNuxtAppOptions, RouteMiddleware, UseFetchOptions } from './composables/index'

export { defineNuxtLink } from './components/index'
export type { NuxtLinkOptions, NuxtLinkProps, NuxtTimeProps } from './components/index'
export { _getAppConfig, updateAppConfig, useAppConfig } from './config'
export { cancelIdleCallback, requestIdleCallback } from './compat/idle-callback'
export type { NuxtAppLiterals, NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext, PageMeta, NuxtPageProps, NuxtLayouts } from './types'

export const isVue2 = false
export const isVue3 = true
