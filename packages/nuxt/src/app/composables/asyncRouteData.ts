import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { NuxtApp } from '../nuxt'
import { dataDiagnostics } from '../diagnostics/data'
import type { AsyncData, AsyncDataErrorOf, AsyncDataOptions, AsyncDataOptionsWithTransform, KeysOf, PickFrom } from './asyncData'
import { isAsyncDataAutoKeyNeeded, useAsyncData } from './asyncData'
import type { NuxtError } from './error'
import { createError } from './error'
import { useRoute } from './router'
import { setResponseStatus, useRequestEvent } from './ssr'

export type AsyncRouteDataHandler<ResT> = (
  route: RouteLocationNormalizedLoaded,
  nuxtApp: NuxtApp,
  options: { signal: AbortSignal },
) => Promise<ResT>

/** Matches page `meta.validate` shape (`status` / `statusText`). */
export type AsyncRouteDataValidateResult = boolean | {
  status?: number
  statusText?: string
}

export interface AsyncRouteDataOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = undefined,
> extends AsyncDataOptions<ResT, DataT, PickKeys, DefaultT> {
  /**
   * Validate resolved data for the current route.
   * Returning anything other than `true` rejects with a Nuxt error (default status 404)
   * and sets the SSR response status when an event is available.
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
  validate?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>['validate']
}

/**
 * Build a flat route-scoped async data key.
 * Payload storage stays flat (`payload.data[key]`); nesting by path is intentionally not used.
 * Paths are URI-encoded so `/foo/bar` and `/foo-bar` do not collide.
 */
export function createRouteAsyncDataKey (routePath: string, key: string): string {
  return `$r:${encodeURIComponent(routePath)}:${key}`
}

function toRouteDataError (
  result: Exclude<AsyncRouteDataValidateResult, true>,
  route: RouteLocationNormalizedLoaded,
): NuxtError {
  const details = result && typeof result === 'object' ? result : undefined
  return createError({
    status: details?.status || 404,
    statusText: details?.statusText || `Page Not Found: ${route.fullPath}`,
    data: {
      path: route.fullPath,
    },
  })
}

async function assertValidRouteData<ResT> (
  data: ResT,
  route: RouteLocationNormalizedLoaded,
  validate: AsyncRouteDataOptions<ResT>['validate'],
): Promise<ResT> {
  if (!validate) {
    return data
  }
  const result = await validate(data, route)
  if (result === true) {
    return data
  }
  const error = toRouteDataError(result, route)
  if (import.meta.server) {
    const event = useRequestEvent()
    if (event) {
      setResponseStatus(event, error.status, error.statusText)
    }
  }
  throw error
}

export interface UseAsyncRouteData {
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined>(
    handler: AsyncRouteDataHandler<ResT>,
    opts: AsyncRouteDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, AsyncDataErrorOf<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(
    handler: AsyncRouteDataHandler<ResT>,
    opts: AsyncRouteDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, AsyncDataErrorOf<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined>(
    handler: AsyncRouteDataHandler<ResT>,
    opts?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, AsyncDataErrorOf<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(
    handler: AsyncRouteDataHandler<ResT>,
    opts?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, AsyncDataErrorOf<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined>(
    key: MaybeRefOrGetter<string>,
    handler: AsyncRouteDataHandler<ResT>,
    opts: AsyncRouteDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, AsyncDataErrorOf<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(
    key: MaybeRefOrGetter<string>,
    handler: AsyncRouteDataHandler<ResT>,
    opts: AsyncRouteDataOptionsWithTransform<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, AsyncDataErrorOf<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = undefined>(
    key: MaybeRefOrGetter<string>,
    handler: AsyncRouteDataHandler<ResT>,
    opts?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, AsyncDataErrorOf<NuxtErrorDataT> | undefined>
  <ResT, NuxtErrorDataT = unknown, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(
    key: MaybeRefOrGetter<string>,
    handler: AsyncRouteDataHandler<ResT>,
    opts?: AsyncRouteDataOptions<ResT, DataT, PickKeys, DefaultT>,
  ): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, AsyncDataErrorOf<NuxtErrorDataT> | undefined>
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
  if (isAsyncDataAutoKeyNeeded(args[0], args[1])) {
    args.unshift(autoKey)
  }

  const [_key, handler, opts = {}] = args as [
    MaybeRefOrGetter<string>,
    AsyncRouteDataHandler<unknown>,
    AsyncRouteDataOptions<unknown>,
  ]

  if (typeof handler !== 'function') {
    throw dataDiagnostics.NUXT_E3009()
  }

  const route = useRoute()
  const { validate, ...asyncDataOpts } = opts

  const resolvedKey = toValue(_key)
  if (!resolvedKey || typeof resolvedKey !== 'string') {
    throw dataDiagnostics.NUXT_E3008()
  }

  const key = computed(() => createRouteAsyncDataKey(route.path, toValue(_key)!))

  return useAsyncData(
    key,
    async (nuxtApp, context) => {
      const data = await handler(route, nuxtApp, context)
      return assertValidRouteData(data, route, validate)
    },
    asyncDataOpts,
  )
} as UseAsyncRouteData
