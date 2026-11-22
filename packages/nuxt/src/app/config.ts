import { reactive } from 'vue'
import { klona } from 'klona'
import { useNuxtApp } from './nuxt'
import type { AppConfig } from 'nuxt/schema'
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
  if (Array.isArray(obj) && Array.isArray(newObj)) {
    obj.length = 0
    obj.push(...newObj)
    return
  }

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
      if (Array.isArray(obj[key]) !== Array.isArray(val)) {
        obj[key] = defaultVal
      } else {
        obj[key] ??= defaultVal
      }

      deepAssign(obj[key], val)
    } else {
      obj[key] = val
    }
  }
}

export function useAppConfig (): AppConfig {
  const nuxtApp = useNuxtApp()
  nuxtApp._appConfig ||= (import.meta.server ? _getServerAppConfig(nuxtApp) : reactive(__appConfig)) as AppConfig
  return nuxtApp._appConfig
}

/**
 * The app config for the current request: the build-time config with any changes made
 * by server code (through the server layer's `useAppConfig`) applied.
 * @internal
 */
export function _getServerAppConfig (nuxtApp: { ssrContext?: { appConfig?: Record<string, any> } }): AppConfig {
  const eventConfig = nuxtApp.ssrContext?.appConfig
  if (!eventConfig) {
    return klona(__appConfig)
  }
  const config = klona(__appConfig)
  deepAssign(config, eventConfig)
  return config
}

/**
 * A minimal diff of `current` against the build-time app config (or an explicit `reference`),
 * carrying changes made during server rendering to the client through the payload.
 * @internal
 */
export function _getAppConfigDiff (current: AppConfig, reference: AppConfig = __appConfig): DeepPartial<AppConfig> | undefined {
  return configDiff(current, reference) as DeepPartial<AppConfig> | undefined
}

function configDiff (current: unknown, reference: unknown): unknown {
  if (Array.isArray(current) && Array.isArray(reference)) {
    if (current.length !== reference.length) { return current }
    for (const [index, value] of current.entries()) {
      if (configDiff(value, reference[index]) !== undefined) { return current }
    }
    return undefined
  }
  if (isPojoOrArray(current) && isPojoOrArray(reference)) {
    // a change of container type is carried as a whole replacement
    if (Array.isArray(current) !== Array.isArray(reference)) { return current }
    let changed = false
    const result: Record<string, unknown> = {}
    const currentObject = current as Record<string, unknown>
    const referenceObject = reference as Record<string, unknown>
    for (const key in currentObject) {
      const value = configDiff(currentObject[key], referenceObject[key])
      if (value !== undefined) {
        result[key] = value
        changed = true
      }
    }
    return changed ? result : undefined
  }
  // functions cannot be serialized into the payload, so they are not carried
  if (typeof current === 'function') { return undefined }
  return current === reference ? undefined : current
}

export function _replaceAppConfig (newConfig: AppConfig): void {
  const appConfig = useAppConfig()

  deepAssign(appConfig, newConfig)
  deepDelete(appConfig, newConfig)
}

/**
 * Deep assign the current appConfig with the new one.
 *
 * Will preserve existing properties.
 */
export function updateAppConfig (appConfig: DeepPartial<AppConfig>): void {
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
