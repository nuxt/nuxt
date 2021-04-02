import { Nuxt } from './nuxt'

export type NuxtHook<Arg1 = any> = (arg1?: Arg1, ...args: any) => Promise<void> | void

export interface NuxtHooks {
  [key: string]: NuxtHook

  'modules:before': NuxtHook<Nuxt>
  'modules:done': NuxtHook<Nuxt>
  'ready': NuxtHook<Nuxt>
}

export type NuxtHookName = keyof NuxtHooks
