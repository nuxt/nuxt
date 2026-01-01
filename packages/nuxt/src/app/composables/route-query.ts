import { navigateTo, useRoute, useRouter } from '#app'
import { withQuery } from 'ufo'
import { type MaybeRef, type MaybeRefOrGetter, type Ref, customRef, getCurrentScope, nextTick, onScopeDispose, toValue, watch } from 'vue'
import type { RouteParamValueRaw, Router } from 'vue-router'

export type RouteQueryValueRaw = RouteParamValueRaw | string[]

export interface ReactiveRouteOptions {
  /**
   * Mode to update the router query, ref is also acceptable
   *
   * @default 'replace'
   */
  mode?: MaybeRef<'replace' | 'push'>
}

export interface ReactiveRouteOptionsWithTransform<V, R> extends ReactiveRouteOptions {
  /**
   * Function to transform data before return, or an object with one or both functions:
   * `get` to transform data before returning, and `set` to transform data before setting
   */
  transform?:
    | ((val: V) => R)
    | ({
      get?: (value: V) => R
      set?: (value: R) => V
    })
}

const _queue = new WeakMap<Router, Map<string, any>>()

function tryOnScopeDispose (fn: () => void, failSilently?: boolean): boolean {
  if (getCurrentScope()) {
    onScopeDispose(fn, failSilently)
    return true
  }
  return false
}

export function useRouteQuery<
  T extends RouteQueryValueRaw = RouteQueryValueRaw,
  K = T,
> (
  name: string,
  defaultValue?: MaybeRefOrGetter<T>,
  options: ReactiveRouteOptionsWithTransform<T, K> = {},
) {
  const {
    mode = 'replace',
    transform,
  } = options

  const route = useRoute()
  const router = useRouter()

  let transformGet = (value: T) => value as unknown as K
  let transformSet = (value: K) => value as unknown as T

  if (typeof transform === 'function') {
    transformGet = transform
  } else if (transform) {
    if (transform.get) { transformGet = transform.get }
    if (transform.set) { transformSet = transform.set }
  }

  if (!_queue.has(router)) { _queue.set(router, new Map()) }

  const _queriesQueue = _queue.get(router)!

  let query = route.query[name] as any

  tryOnScopeDispose(() => {
    query = undefined
  })

  let _trigger: () => void

  const proxy = customRef<any>((track, trigger) => {
    _trigger = trigger

    return {
      get () {
        track()

        return transformGet(query !== undefined ? query : toValue(defaultValue))
      },
      async set (v) {
        v = transformSet(v)

        if (query === v) { return }

        query = (v === toValue(defaultValue)) ? undefined : v

        if (import.meta.server) {
          const navigateToPath = withQuery(route.fullPath, {
            [name]: query,
          })

          return await navigateTo(
            navigateToPath,
            {
              replace: mode === 'replace',
              redirectCode: mode === 'replace' ? 301 : 302,
            },
          )
        }

        _queriesQueue.set(name, (v === toValue(defaultValue)) ? undefined : v)

        trigger()

        nextTick(() => {
          if (_queriesQueue.size === 0) { return }

          const newQueries = Object.fromEntries(_queriesQueue.entries())
          _queriesQueue.clear()

          const { params, query, hash } = route

          router[toValue(mode)]({
            params,
            query: { ...query, ...newQueries },
            hash,
          })
        })
      },
    }
  })

  watch(
    () => route.query[name],
    (v) => {
      if (query === transformGet(v as T)) { return }

      query = v

      _trigger()
    },
    { flush: 'sync' },
  )

  return proxy as Ref<K>
}
