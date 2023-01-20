import type { AppConfig } from '@nuxt/schema'
import { reactive } from 'vue'
import { useNuxtApp } from './nuxt'
// @ts-ignore
import __appConfig from '#build/app.config.mjs'

type DeepPartial<T> = T extends Function ? T : T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> } : T

// Workaround for vite HMR with virtual modules
export const _getAppConfig = () => __appConfig as AppConfig

function deepDelete (obj: any, newObj: any) {
  for (const key in obj) {
    const val = newObj[key]
    if (!(key in newObj)) {
      delete (obj as any)[key]
    }

    if (val !== null && typeof val === 'object') {
      deepDelete(obj[key], newObj[key])
    }
  }
}

function deepAssign (obj: any, newObj: any) {
  for (const key in newObj) {
    const val = newObj[key]
    if (val !== null && typeof val === 'object') {
      obj[key] = obj[key] || {}
      deepAssign(obj[key], val)
    } else {
      obj[key] = val
    }
  }
}

export function useAppConfig (): AppConfig {
  const nuxtApp = useNuxtApp()
  if (!nuxtApp._appConfig) {
    nuxtApp._appConfig = reactive(__appConfig) as AppConfig
  }
  return nuxtApp._appConfig
}

/**
 * Deep assign the current appConfig with the new one.
 *
 * Will preserve existing properties.
 */
export function updateAppConfig (appConfig: DeepPartial<AppConfig>) {
  const _appConfig = useAppConfig()
  deepAssign(_appConfig, appConfig)
}

// HMR Support
if (process.dev) {
  function applyHMR (newConfig: AppConfig) {
    const appConfig = useAppConfig()
    if (newConfig && appConfig) {
      deepAssign(appConfig, newConfig)
      deepDelete(appConfig, newConfig)
    }
  }

  // Vite
  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      const newConfig = newModule._getAppConfig()
      applyHMR(newConfig)
    })
  }

  // webpack
  if (import.meta.webpackHot) {
    import.meta.webpackHot.accept('#build/app.config.mjs', () => {
      applyHMR(__appConfig)
    })
  }
}
