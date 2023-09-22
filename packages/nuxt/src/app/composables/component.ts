import { getCurrentInstance, reactive, toRefs } from 'vue'
import type { DefineComponent, defineComponent } from 'vue'
import { useHead } from '@unhead/vue'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { useAsyncData } from './asyncData'
import { useRoute } from './router'
import { createError } from './error'

export const NuxtComponentIndicator = '__nuxt_component'

async function runLegacyAsyncData (res: Record<string, any> | Promise<Record<string, any>>, fn: (nuxtApp: NuxtApp) => Promise<Record<string, any>>) {
  const nuxtApp = useNuxtApp()
  const route = useRoute()
  const vm = getCurrentInstance()!
  const { fetchKey, _fetchKeyBase } = vm.proxy!.$options
  const key = (typeof fetchKey === 'function' ? fetchKey(() => '') : fetchKey) ||
    ([_fetchKeyBase, route.fullPath, route.matched.findIndex(r => Object.values(r.components || {}).includes(vm.type))].join(':'))
  const { data, error } = await useAsyncData(`options:asyncdata:${key}`, () => nuxtApp.runWithContext(() => fn(nuxtApp)))
  if (error.value) {
    throw createError(error.value)
  }
  if (data.value && typeof data.value === 'object') {
    Object.assign(await res, toRefs(reactive(data.value)))
  } else if (import.meta.dev) {
    console.warn('[nuxt] asyncData should return an object', data)
  }
}

/*! @__NO_SIDE_EFFECTS__ */
export const defineNuxtComponent: typeof defineComponent =
  function defineNuxtComponent (...args: any[]): any {
    const [options, key] = args
    const { setup } = options

    // Avoid wrapping if no options api is used
    if (!setup && !options.asyncData && !options.head) {
      return {
        [NuxtComponentIndicator]: true,
        ...options
      }
    }

    return {
      [NuxtComponentIndicator]: true,
      _fetchKeyBase: key,
      ...options,
      setup (props, ctx) {
        const nuxtApp = useNuxtApp()
        const res = setup ? Promise.resolve(nuxtApp.runWithContext(() => setup(props, ctx))).then(r => r || {}) : {}

        const promises: Promise<any>[] = []
        if (options.asyncData) {
          promises.push(runLegacyAsyncData(res, options.asyncData))
        }

        if (options.head) {
          const nuxtApp = useNuxtApp()
          useHead(typeof options.head === 'function' ? () => options.head(nuxtApp) : options.head)
        }

        return Promise.resolve(res)
          .then(() => Promise.all(promises))
          .then(() => res)
          .finally(() => {
            promises.length = 0
          })
      }
    } as DefineComponent
  }
