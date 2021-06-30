import { toRefs } from '@vue/reactivity'
import { ComponentInternalInstance, DefineComponent, defineComponent, getCurrentInstance } from 'vue'
import { useRoute } from 'vue-router'
import type { LegacyContext } from '../legacy'
import { useNuxt } from '../nuxt'
import { asyncData } from './asyncData'

export const NuxtComponentIndicator = '__nuxt_component'
export const NuxtComponentPendingPromises = '_pendingPromises'

export interface NuxtComponentInternalInstance extends ComponentInternalInstance {
  [NuxtComponentPendingPromises]: Array<Promise<void>>
}

export function getCurrentNuxtComponentInstance (): NuxtComponentInternalInstance {
  const vm = getCurrentInstance() as NuxtComponentInternalInstance

  if (!vm || !vm.proxy.$options[NuxtComponentIndicator]) {
    throw new Error('This method can only be used within a component defined with `defineNuxtComponent()`.')
  }

  return vm
}

export function enqueueNuxtComponent (p: Promise<void>) {
  const vm = getCurrentNuxtComponentInstance()
  vm[NuxtComponentPendingPromises].push(p)
}

async function runLegacyAsyncData (res: Record<string, any> | Promise<Record<string, any>>, fn: (context: LegacyContext) => Promise<Record<string, any>>) {
  const nuxt = useNuxt()
  const route = useRoute()
  const vm = getCurrentNuxtComponentInstance()
  const { fetchKey } = vm.proxy.$options
  const key = typeof fetchKey === 'function' ? fetchKey(() => '') : fetchKey || route.fullPath
  const { data } = await asyncData(`options:asyncdata:${key}`, () => fn(nuxt._legacyContext))
  Object.assign(await res, toRefs(data))
}

export const defineNuxtComponent: typeof defineComponent =
  function defineNuxtComponent (options: any): any {
    const { setup } = options

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
        const vm = getCurrentNuxtComponentInstance()
        let promises = vm[NuxtComponentPendingPromises] = vm[NuxtComponentPendingPromises] || []

        const res = setup?.(props, ctx) || {}

        if (options.asyncData) {
          promises.push(runLegacyAsyncData(res, options.asyncData))
        }

        if (!promises.length && !(res instanceof Promise)) {
          return res
        }

        return Promise.resolve(res)
          .then(() => Promise.all(promises))
          .then(() => res)
          .finally(() => {
            promises.length = 0
            promises = null
            delete vm[NuxtComponentPendingPromises]
          })
      }
    } as DefineComponent
  }
