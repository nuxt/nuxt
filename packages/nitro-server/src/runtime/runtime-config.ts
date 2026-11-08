import process from 'node:process'
import { klona } from 'klona'
import type { H3Event } from 'h3'
import type { NitroRuntimeConfig } from 'nitropack/types'

import { appConfig as _inlineAppConfig } from '#nitro-internal-virtual/app-config'
import schema, { strictPaths } from '#internal/nuxt/runtime-config-schema'
import { createRuntimeConfigResolver } from './utils/runtime-config'

// replaced with the serialised runtime config when nitro bundles the server
const _inlineRuntimeConfig = process.env.RUNTIME_CONFIG as unknown as NitroRuntimeConfig

const resolveRuntimeConfig = createRuntimeConfigResolver(_inlineRuntimeConfig, schema, process.env, strictPaths)

let _sharedRuntimeConfig: NitroRuntimeConfig | undefined

export function useRuntimeConfig (event?: H3Event): NitroRuntimeConfig {
  if (!event) {
    return _sharedRuntimeConfig ??= deepFreeze(resolveRuntimeConfig())
  }
  const context = event.context.nitro ||= {}
  return context.runtimeConfig ??= resolveRuntimeConfig()
}

const _sharedAppConfig = deepFreeze(klona(_inlineAppConfig))

export function useAppConfig (event?: H3Event): Record<string, unknown> {
  if (!event) {
    return _sharedAppConfig
  }
  const context = event.context.nitro ||= {}
  return context.appConfig ??= klona(_inlineAppConfig)
}

export default new Proxy(Object.create(null), {
  get: (_, prop: string) => {
    console.warn('Please use `useRuntimeConfig()` instead of accessing config directly.')
    const runtimeConfig = useRuntimeConfig() as Record<string, unknown>
    return prop in runtimeConfig ? runtimeConfig[prop] : undefined
  },
})

function deepFreeze<T> (object: T): T {
  for (const name of Object.getOwnPropertyNames(object)) {
    const value = (object as Record<string, unknown>)[name]
    if (value && typeof value === 'object') {
      deepFreeze(value)
    }
  }
  return Object.freeze(object)
}
