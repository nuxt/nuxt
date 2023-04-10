import { getCurrentInstance, reactive, toRefs } from 'vue'
import type { DefineComponent, defineComponent } from 'vue'
import { useHead } from '@unhead/vue'
import type { NuxtApp } from '../nuxt'
import { callWithNuxt, useNuxtApp } from '../nuxt'
import { useAsyncData } from './asyncData'
import { useRoute } from './router'

export const NuxtComponentIndicator = '__nuxt_component'

async function runLegacyAsyncData (res: Record<string, any> | Promise<Record<string, any>>, fn: (nuxtApp: NuxtApp) => Promise<Record<string, any>>) {
  const nuxt = useNuxtApp()
  const route = useRoute()
  const vm = getCurrentInstance()!
  const { fetchKey } = vm.proxy!.$options
  const key = typeof fetchKey === 'function' ? fetchKey(() => '') : fetchKey || route.fullPath
  const { data } = await useAsyncData(`options:asyncdata:${key}`, () => callWithNuxt(nuxt, fn, [nuxt]))
  if (data.value && typeof data.value === 'object') {
    Object.assign(await res, toRefs(reactive(data.value)))
  } else if (process.dev) {
    console.warn('[nuxt] asyncData should return an object', data)
  }
}

export const defineNuxtComponent: typeof defineComponent =
  function defineNuxtComponent (options: any): any {
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
      ...options,
      setup (props, ctx) {
        const nuxtApp = useNuxtApp()
        const res = setup ? Promise.resolve(callWithNuxt(nuxtApp, setup, [props, ctx])).then(r => r || {}) : {}

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
