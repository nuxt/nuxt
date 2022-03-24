import type { Hookable } from 'hookable'
// @ts-ignore
import type { Vue } from 'vue/types/vue'
import type { ComponentOptions } from 'vue'
import { defineComponent, getCurrentInstance } from './composables'

export const isVue2 = true
export const isVue3 = false

export const defineNuxtComponent = defineComponent

export interface VueAppCompat {
  component: Vue['component'],
  config: {
    globalProperties: any
    [key: string]: any
  },
  directive: Vue['directive'],
  mixin: Vue['mixin'],
  mount: Vue['mount'],
  provide: (name: string, value: any) => void,
  unmount: Vue['unmount'],
  use: Vue['use']
  version: string
}

export interface RuntimeNuxtHooks {
  'vue:setup': () => void
  'app:mounted': (app: VueAppCompat) => void | Promise<void>
  'meta:register': (metaRenderers: any[]) => void | Promise<void>
}

export interface NuxtAppCompat {
  nuxt2Context: Vue
  vue2App: ComponentOptions<Vue>

  vueApp: VueAppCompat

  globalName: string

  hooks: Hookable<RuntimeNuxtHooks>
  hook: NuxtAppCompat['hooks']['hook']
  callHook: NuxtAppCompat['hooks']['callHook']

  [key: string]: any

  ssrContext?: Record<string, any>
  payload: {
    [key: string]: any
  }

  provide: (name: string, value: any) => void
}

export interface Context {
  $_nuxtApp: NuxtAppCompat
}

let currentNuxtAppInstance: NuxtAppCompat | null

export const setNuxtAppInstance = (nuxt: NuxtAppCompat | null) => {
  currentNuxtAppInstance = nuxt
}

/**
 * Ensures that the setup function passed in has access to the Nuxt instance via `useNuxt`.
 *
 * @param nuxt A Nuxt instance
 * @param setup The function to call
 */
export function callWithNuxt<T extends (...args: any[]) => any> (nuxt: NuxtAppCompat, setup: T, args?: Parameters<T>) {
  setNuxtAppInstance(nuxt)
  const p: ReturnType<T> = args ? setup(...args as Parameters<T>) : setup()
  if (process.server) {
    // Unset nuxt instance to prevent context-sharing in server-side
    setNuxtAppInstance(null)
  }
  return p
}

interface Plugin {
  (nuxt: NuxtAppCompat): Promise<void> | Promise<{ provide?: Record<string, any> }> | void | { provide?: Record<string, any> }
}

export function defineNuxtPlugin (plugin: Plugin): (ctx: Context, inject: (id: string, value: any) => void) => void {
  return async (ctx, inject) => {
    const result = await callWithNuxt(ctx.$_nuxtApp, plugin, [ctx.$_nuxtApp])
    if (result && result.provide) {
      for (const key in result.provide) {
        inject(key, result.provide[key])
      }
    }
    return result
  }
}

export const useNuxtApp = (): NuxtAppCompat => {
  const vm = getCurrentInstance()

  if (!vm) {
    if (!currentNuxtAppInstance) {
      throw new Error('nuxt app instance unavailable')
    }
    return currentNuxtAppInstance
  }

  return vm.proxy.$_nuxtApp
}
