import { ComponentInternalInstance, DefineComponent, defineComponent, getCurrentInstance } from 'vue'

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

export const defineNuxtComponent: typeof defineComponent =
  function defineNuxtComponent (options: any): any {
    const { setup } = options

    if (!setup) {
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

        const res = setup(props, ctx)

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
