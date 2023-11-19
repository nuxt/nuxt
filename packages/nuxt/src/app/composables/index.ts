import type { UseHeadInput } from "@unhead/vue";
import type { HeadAugmentations } from "nuxt/schema";

/** @deprecated Use `UseHeadInput` from `@unhead/vue` instead. This may be removed in a future minor version. */
export type MetaObject = UseHeadInput<HeadAugmentations>;
export {
  /** @deprecated Import `useHead` from `#imports` instead. This may be removed in a future minor version. */
  useHead,
  /** @deprecated Import `useSeoMeta` from `#imports` instead. This may be removed in a future minor version. */
  useSeoMeta,
  /** @deprecated Import `useServerSeoMeta` from `#imports` instead. This may be removed in a future minor version. */
  useServerSeoMeta,
} from "@unhead/vue";

export {
  clearNuxtData,
  refreshNuxtData,
  useAsyncData,
  useLazyAsyncData,
  useNuxtData,
} from "./asyncData";
export type { AsyncData, AsyncDataOptions } from "./asyncData";
export { reloadNuxtApp } from "./chunk";
export type { ReloadNuxtAppOptions } from "./chunk";
export { defineNuxtComponent } from "./component";
export { useCookie } from "./cookie";
export type { CookieOptions, CookieRef } from "./cookie";
export {
  clearError,
  createError,
  isNuxtError,
  showError,
  useError,
} from "./error";
export type { NuxtError } from "./error";
export { useFetch, useLazyFetch } from "./fetch";
export type { FetchResult, UseFetchOptions } from "./fetch";
export { useHydration } from "./hydrate";
export { getAppManifest, getRouteRules } from "./manifest";
export type { NuxtAppManifest, NuxtAppManifestMeta } from "./manifest";
export {
  definePayloadReducer,
  definePayloadReviver,
  isPrerendered,
  loadPayload,
  preloadPayload,
} from "./payload";
export {
  prefetchComponents,
  preloadComponents,
  preloadRouteComponents,
} from "./preload";
export { onNuxtReady } from "./ready";
export {
  abortNavigation,
  addRouteMiddleware,
  defineNuxtRouteMiddleware,
  navigateTo,
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  setPageLayout,
  useRoute,
  useRouteParams,
  useRouteQuery,
  useRouter,
} from "./router";
export type { AddRouteMiddlewareOptions, RouteMiddleware } from "./router";
export {
  prerenderRoutes,
  setResponseStatus,
  useRequestEvent,
  useRequestFetch,
  useRequestHeaders,
} from "./ssr";
export { clearNuxtState, useState } from "./state";
export { useRequestURL } from "./url";
