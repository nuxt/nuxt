import { defineComponent, getCurrentInstance, reactive, toRefs } from 'vue'
import type { DefineComponent } from 'vue'
import { useRoute } from 'vue-router'
import type { LegacyContext } from '../compat/legacy-app'
import { useNuxtApp } from '../nuxt'
import { useAsyncData } from './asyncData'

export const NuxtComponentIndicator = '__nuxt_component'

async function runLegacyAsyncData (res: Record<string, any> | Promise<Record<string, any>>, fn: (context: LegacyContext) => Promise<Record<string, any>>) {
  const nuxt = useNuxtApp()
  const route = useRoute()
  const vm = getCurrentInstance()
  const { fetchKey } = vm.proxy.$options
  const key = typeof fetchKey === 'function' ? fetchKey(() => '') : fetchKey || route.fullPath
  const { data } = await useAsyncData(`options:asyncdata:${key}`, () => fn(nuxt._legacyContext))
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
    if (!setup && !options.asyncData) {
      return {
        [NuxtComponentIndicator]: true,
        ...options
      }
    }

    return {
      [NuxtComponentIndicator]: true,
      ...options,
      setup (props, ctx) {
        const res = setup?.(props, ctx) || {}

        let promises: unknown[] | undefined = []
        promises = promises || []
        if (options.asyncData) {
          promises.push(runLegacyAsyncData(res, options.asyncData))
        }

        return Promise.resolve(res)
          .then(() => Promise.all(promises))
          .then(() => res)
          .finally(() => {
            promises.length = 0
            promises = null
          })
      }
    } as DefineComponent
  }
