import { computed, getCurrentInstance } from 'vue'
import type { DefineComponent, defineComponent } from 'vue'
import { hash } from 'ohash'
import type { NuxtApp } from '../nuxt'
import { getNuxtAppCtx, useNuxtApp } from '../nuxt'
import { useHead } from './head'
import { useAsyncData } from './asyncData'
import { useRoute } from './router'
import { createError } from './error'

export const NuxtComponentIndicator = '__nuxt_component'

/* @__NO_SIDE_EFFECTS__ */
function getFetchKey () {
  const vm = getCurrentInstance()!
  const route = useRoute()
  const { _fetchKeyBase } = vm.proxy!.$options
  return hash([
    _fetchKeyBase,
    route.path,
    route.query,
    route.matched.findIndex(r => Object.values(r.components || {}).includes(vm.type)),
  ])
}

async function runLegacyAsyncData (res: Record<string, any> | Promise<Record<string, any>>, fn: (nuxtApp: NuxtApp) => Promise<Record<string, any>>) {
  const nuxtApp = useNuxtApp()
  const { fetchKey } = getCurrentInstance()!.proxy!.$options
  const key = (typeof fetchKey === 'function' ? fetchKey(() => '') : fetchKey) || getFetchKey()
  const { data, error } = await useAsyncData(`options:asyncdata:${key}`, () => import.meta.server ? nuxtApp.runWithContext(() => fn(nuxtApp)) : fn(nuxtApp))
  if (error.value) {
    throw createError(error.value)
  }
  if (data.value && typeof data.value === 'object') {
    const _res = await res
    for (const key in data.value) {
      _res[key] = computed({
        get: () => data.value?.[key],
        set (v) {
          data.value ||= {}
          data.value[key] = v
        },
      })
    }
  } else if (import.meta.dev) {
    console.warn('[nuxt] asyncData should return an object', data)
  }
}

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export const defineNuxtComponent: typeof defineComponent =
  function defineNuxtComponent (...args: any[]): any {
    const [options, key] = args
    const { setup } = options as DefineComponent

    // Avoid wrapping if no options api is used
    if (!setup && !options.asyncData && !options.head) {
      return {
        [NuxtComponentIndicator]: true,
        ...options,
      }
    }

    return {
      [NuxtComponentIndicator]: true,
      _fetchKeyBase: key,
      ...options,
      setup (props, ctx) {
        const nuxtApp = useNuxtApp()

        let res = {}
        if (setup) {
          const fn = (): Promise<Record<string, any>> => Promise.resolve(setup(props, ctx)).then((r: any) => r || {})
          const nuxtAppCtx = getNuxtAppCtx(nuxtApp._id)
          if (import.meta.server) {
            res = nuxtAppCtx.callAsync(nuxtApp, fn)
          } else {
            nuxtAppCtx.set(nuxtApp)
            res = fn()
          }
        }

        const promises: Promise<any>[] = []
        if (options.asyncData) {
          promises.push(runLegacyAsyncData(res, options.asyncData))
        }

        if (options.head) {
          useHead(typeof options.head === 'function' ? () => options.head(nuxtApp) : options.head)
        }

        return Promise.resolve(res)
          .then(() => Promise.all(promises))
          .then(() => res)
          .finally(() => {
            promises.length = 0
          })
      },
    } as DefineComponent
  }
