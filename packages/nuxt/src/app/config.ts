import type { AppConfig } from '@nuxt/schema'
import { reactive } from 'vue'
import { useNuxtApp } from './nuxt'
// @ts-ignore
import __appConfig from '#build/app.config.mjs'

// Workaround for vite HMR with virtual modules
export const _getAppConfig = () => __appConfig as AppConfig

export function useAppConfig (): AppConfig {
  const nuxtApp = useNuxtApp()
  if (!nuxtApp._appConfig) {
    nuxtApp._appConfig = reactive(__appConfig) as AppConfig
  }
  return nuxtApp._appConfig
}

// HMR Support
if (process.dev) {
  function applyHMR (newConfig: AppConfig) {
    const appConfig = useAppConfig()
    if (newConfig && appConfig) {
      for (const key in newConfig) {
        (appConfig as any)[key] = (newConfig as any)[key]
      }
      for (const key in appConfig) {
        if (!(key in newConfig)) {
          delete (appConfig as any)[key]
        }
      }
    }
  }

  // Vite
  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      const newConfig = newModule._getAppConfig()
      applyHMR(newConfig)
    })
  }

  // Webpack
  if (import.meta.webpackHot) {
    import.meta.webpackHot.accept('#build/app.config.mjs', () => {
      applyHMR(__appConfig)
    })
  }
}
