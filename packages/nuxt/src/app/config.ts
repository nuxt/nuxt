import { reactive } from 'vue'
import { klona } from 'klona'
import { useNuxtApp } from './nuxt'
import type { AppConfig } from 'nuxt/schema'
// @ts-expect-error virtual file
import __appConfig from '#build/app.config.mjs'

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type DeepPartial<T> = T extends Function ? T : T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> } : T

// Workaround for vite HMR with virtual modules
export const _getAppConfig = () => __appConfig as AppConfig

function isPojoOrArray (val: unknown): val is object {
  return (
    Array.isArray(val) ||
    (!!val &&
      typeof val === 'object' &&
      val.constructor?.name === 'Object')
  )
}

function deepDelete (obj: any, newObj: any) {
  for (const key in obj) {
    const val = newObj[key]
    if (!(key in newObj)) {
      delete (obj as any)[key]
    }

    if (isPojoOrArray(val)) {
      deepDelete(obj[key], newObj[key])
    }
  }
}

function deepAssign (obj: any, newObj: any) {
  for (const key in newObj) {
    if (key === '__proto__' || key === 'constructor') { continue }
    const val = newObj[key]
    if (isPojoOrArray(val)) {
      const defaultVal = Array.isArray(val) ? [] : {}
      obj[key] ||= defaultVal
      deepAssign(obj[key], val)
    } else {
      obj[key] = val
    }
  }
}

export function useAppConfig (): AppConfig {
  const nuxtApp = useNuxtApp()
  nuxtApp._appConfig ||= (import.meta.server ? klona(__appConfig) : reactive(__appConfig)) as AppConfig
  return nuxtApp._appConfig
}

export function _replaceAppConfig (newConfig: AppConfig) {
  const appConfig = useAppConfig()

  deepAssign(appConfig, newConfig)
  deepDelete(appConfig, newConfig)
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
if (import.meta.dev) {
  // Vite
  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      const newConfig = newModule?._getAppConfig()
      if (newConfig) {
        _replaceAppConfig(newConfig)
      }
    })
  }

  // webpack
  if (import.meta.webpackHot) {
    import.meta.webpackHot.accept('#build/app.config.mjs', () => {
      _replaceAppConfig(__appConfig)
    })
  }
}
