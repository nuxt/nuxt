import { useNuxtApp } from '#app'
import { useId as _useId } from 'vue'
import { componentIslands } from '#build/nuxt.config.mjs'

export const useId: typeof _useId = import.meta.server && componentIslands
  ? (): string => {
      const nuxtApp = useNuxtApp()
      if (nuxtApp.ssrContext?.islandContext) {
        return nuxtApp.ssrContext.islandContext.id + useId()
      }
      return _useId()
    }
  : _useId
