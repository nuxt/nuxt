import { ComputedRef, /* KeepAliveProps, */ Ref, TransitionProps } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'
import { useNuxtApp } from '#app'

export const useRouter = () => {
  return useNuxtApp().$router as Router
}

export const useRoute = () => {
  return useNuxtApp()._route as RouteLocationNormalizedLoaded
}

export interface PageMeta {
  [key: string]: any
  transition?: false | TransitionProps
  layout?: false | string | Ref<false | string> | ComputedRef<false | string>
  // TODO: https://github.com/vuejs/vue-next/issues/3652
  // keepalive?: false | KeepAliveProps
}

declare module 'vue-router' {
  interface RouteMeta extends PageMeta {}
}

const warnRuntimeUsage = (method: string) =>
  console.warn(
    `${method}() is a compiler-hint helper that is only usable inside ` +
      '<script setup> of a single file component. Its arguments should be ' +
      'compiled away and passing it at runtime has no effect.'
  )

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const definePageMeta = (meta: PageMeta): void => {
  if (process.dev) {
    warnRuntimeUsage('definePageMeta')
  }
}
