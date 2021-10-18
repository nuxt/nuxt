import type { Hookable } from 'hookable'
// @ts-ignore
import type { Vue } from 'vue/types/vue'
import type { ComponentOptions } from 'vue'
import { defineComponent, getCurrentInstance } from './composables'

export const defineNuxtComponent = defineComponent

export interface RuntimeNuxtHooks { }

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
  // eslint-disable-next-line
  $_nuxtApp: NuxtAppCompat
}

let currentNuxtAppInstance: NuxtAppCompat | null

export const setNuxtAppInstance = (nuxt: NuxtAppCompat | null) => {
  currentNuxtAppInstance = nuxt
}

export const defineNuxtPlugin = plugin => (ctx: Context) => {
  setNuxtAppInstance(ctx.$_nuxtApp)
  plugin(ctx.$_nuxtApp)
  setNuxtAppInstance(null)
}

export const useNuxtApp = () => {
  const vm = getCurrentInstance()

  if (!vm) {
    if (!currentNuxtAppInstance) {
      throw new Error('nuxt app instance unavailable')
    }
    return currentNuxtAppInstance
  }

  return vm?.proxy.$_nuxtApp
}
