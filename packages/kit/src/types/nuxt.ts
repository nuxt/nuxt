import { NuxtHookName, NuxtHook, NuxtHooks } from './hooks'
import { NuxtOptions } from './config'

export interface Nuxt {
  options: NuxtOptions

  hooks: {
    hook(hookName: NuxtHookName, callback: NuxtHook)
    callHook<T extends string>(hookbname: T, ...args: Parameters<NuxtHooks[T]>)
    addHooks(hooks: Partial<NuxtHooks>)
  }
  hook: Nuxt['hooks']['hook']
  callHook: Nuxt['hooks']['callHook']

  server?: any
}
