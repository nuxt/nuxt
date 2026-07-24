import { computed, isRef, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { NuxtApp } from '../nuxt'
import { dataDiagnostics } from '../diagnostics/data'
import type { AsyncData, AsyncDataOptions, AsyncDataOptionsWithTransform, KeysOf, PickFrom } from './asyncData'
import { useAsyncData } from './asyncData'
import type { NuxtError } from './error'
import { createError } from './error'
import { useRoute } from './router'
import { setResponseStatus, useRequestEvent } from './ssr'

export type AsyncRouteDataHandler<ResT> = (
  route: RouteLocationNormalizedLoaded,
  nuxtApp: NuxtApp,
  options: { signal: AbortSignal },
) => Promise<ResT>

export type AsyncRouteDataValidateResult = boolean | {
  status?: number
  statusCode?: number
  statusText?: string
  statusMessage?: string
}

export interface AsyncRouteDataOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> extends AsyncDataOptions<ResT, DataT, PickKeys, DefaultT> {
  /**
   * Validate resolved data for the current route. Returning anything other than `true` throws a 404 (or the provided status).
   */
  validate?: (
    data: ResT,
    route: RouteLocationNormalizedLoaded,
  ) => AsyncRouteDataValidateResult | Promise<AsyncRouteDataValidateResult>
}

export interface AsyncRouteDataOptionsWithTransform<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> extends AsyncDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT> {
  validate?: (
    data: ResT,
    route: RouteLocationNormalizedLoaded,
  ) => AsyncRouteDataValidateResult | Promise<AsyncRouteDataValidateResult>
}

/**
 * Build a flat route-scoped async data key.
 * Payload storage stays flat (`payload.data[key]`); nesting by path is intentionally not used.
 * Paths are URI-encoded so `/foo/bar` and `/foo-bar` do not collide.
 */
export function createRouteAsyncDataKey (routePath: string, key: string): string {
  return `$r:${encodeURIComponent(routePath)}:${key}`
}

function isAutoKeyNeeded (
  keyOrHandler: string | MaybeRefOrGetter<string> | AsyncRouteDataHandler<any>,
  handler: AsyncRouteDataHandler<any> | AsyncRouteDataOptions<any> | undefined,
): boolean {
  if (typeof keyOrHandler === 'string') {
    return false
  }
  if (typeof keyOrHandler === 'object' && keyOrHandler !== null) {
    return false
  }
  if (typeof keyOrHandler === 'function' && typeof handler === 'function') {
    return false
  }
  return true
}

function applyValidate<ResT> (
  data: ResT,
  route: RouteLocationNormalizedLoaded,
  validate: AsyncRouteDataOptions<ResT>['validate'],
): Promise<ResT> {
  if (!validate) {
    return Promise.resolve(data)
  }
  return Promise.resolve(validate(data, route)).then((result) => {
    if (result === true) {
      return data
    }
    const details = result && typeof result === 'object' ? result : undefined
    const status = details?.status ?? details?.statusCode ?? 404
    const statusText = details?.statusText ?? details?.statusMessage ?? `Page Not Found: ${route.fullPath}`
    if (import.meta.server) {
      const event = useRequestEvent()
      if (event) {
        setResponseStatus(event, status, statusText)
      }
    }
    throw createError({
      status,
      statusText,
      data: {
        path: route.fullPath,
      },
    })
  })
}

type NuxtErrorFor<NuxtErrorDataT> = NuxtErrorDataT extends Error | NuxtError ? NuxtErrorDataT : NuxtError<NuxtErrorDataT>

export interface UseAsyncRouteData {
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined>(
    handler: AsyncRouteDataHandler<ResT>,
    opts: AsyncRouteDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(
    handler: AsyncRouteDataHandler<ResT>,
    opts: AsyncRouteDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined>(
    handler: AsyncRouteDataHandler<ResT>,
    opts?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(
    handler: AsyncRouteDataHandler<ResT>,
    opts?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined>(
    key: MaybeRefOrGetter<string>,
    handler: AsyncRouteDataHandler<ResT>,
    opts: AsyncRouteDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(
    key: MaybeRefOrGetter<string>,
    handler: AsyncRouteDataHandler<ResT>,
    opts: AsyncRouteDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined>(
    key: MaybeRefOrGetter<string>,
    handler: AsyncRouteDataHandler<ResT>,
    opts?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(
    key: MaybeRefOrGetter<string>,
    handler: AsyncRouteDataHandler<ResT>,
    opts?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, NuxtErrorFor<NuxtErrorDataT> | undefined>
}

/**
 * Route-scoped wrapper around {@link useAsyncData}.
 * Keys are automatically prefixed with an encoded `route.path` so data stays unique across page transitions.
 * The handler receives the current route as its first argument.
 * @see https://github.com/nuxt/nuxt/issues/31556
 * @since 4.6.0
 */
export const useAsyncRouteData: UseAsyncRouteData = function useAsyncRouteData (...args: any[]): AsyncData<any, any> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (isAutoKeyNeeded(args[0], args[1])) {
    args.unshift(autoKey)
  }

  const [_key, _handler, opts = {}] = args as [
    MaybeRefOrGetter<string>,
    AsyncRouteDataHandler<any>,
    AsyncRouteDataOptions<any>,
  ]

  const userKey = (isRef(_key) || typeof _key === 'function'
    ? computed(() => toValue(_key)!)
    : { value: _key as string }) as { readonly value: string }

  if (!userKey.value || typeof userKey.value !== 'string') {
    throw dataDiagnostics.NUXT_E3008()
  }
  if (typeof _handler !== 'function') {
    throw dataDiagnostics.NUXT_E3009()
  }

  const route = useRoute()
  const { validate, ...asyncDataOpts } = opts

  const key = computed(() => createRouteAsyncDataKey(route.path, userKey.value))

  return useAsyncData(
    key,
    (nuxtApp, context) => {
      const currentRoute = route
      return Promise.resolve(_handler(currentRoute, nuxtApp, context))
        .then(data => applyValidate(data, currentRoute, validate))
    },
    asyncDataOpts,
  )
} as UseAsyncRouteData
