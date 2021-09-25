import type { Hookable } from 'hookable'
// @ts-ignore
import type { Vue } from 'vue/types/vue'
import type { ComponentOptions } from 'vue'
import { defineComponent, getCurrentInstance } from './composables'

export const defineNuxtComponent = defineComponent

export interface RuntimeNuxtHooks { }

export interface NuxtAppCompat {
  legacyNuxt: Vue
  legacyApp: ComponentOptions<Vue>

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

let currentNuxtInstance: NuxtAppCompat | null

export const setNuxtInstance = (nuxt: NuxtAppCompat | null) => {
  currentNuxtInstance = nuxt
}

export const defineNuxtPlugin = plugin => (ctx: Context) => {
  setNuxtInstance(ctx.$_nuxtApp)
  plugin(ctx.$_nuxtApp)
  setNuxtInstance(null)
}

export const useNuxtApp = () => {
  const vm = getCurrentInstance()

  if (!vm) {
    if (!currentNuxtInstance) {
      throw new Error('nuxt instance unavailable')
    }
    return currentNuxtInstance
  }

  return vm?.proxy.$_nuxtApp
}
