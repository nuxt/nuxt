import { NuxtHookName, NuxtHooks } from './hooks'
import { NuxtOptions } from './config'

export interface Nuxt {
  /** The resolved Nuxt configuration. */
  options: NuxtOptions

  hooks: {
    /** Register a function to be run when the named Nuxt hook is called. */
    hook<Hook extends NuxtHookName>(hookName: Hook, callback: NuxtHooks[Hook]): void | Promise<void>
    /** Run all Nuxt hooks that have been registered against the hook name. */
    callHook<Hook extends NuxtHookName>(hookName: Hook, ...args: Parameters<NuxtHooks[Hook]>): ReturnType<NuxtHooks[Hook]>
    /** Add all hooks in the object passed in. */
    addHooks(hooks: Partial<NuxtHooks>): void
  }
  hook: Nuxt['hooks']['hook']
  callHook: Nuxt['hooks']['callHook']

  ready: () => Promise<void>
  close: () => Promise<void>

  /** The production or development server */
  server?: any
}
