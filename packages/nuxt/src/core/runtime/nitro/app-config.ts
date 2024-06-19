import type { H3Event } from 'h3'
import { klona } from 'klona'

// @ts-expect-error virtual file
import _inlineAppConfig from '#internal/nuxt/app-config'

// App config
const _sharedAppConfig = _deepFreeze(klona(_inlineAppConfig))
export function useAppConfig (event?: H3Event) {
  // Backwards compatibility with ambient context
  if (!event) {
    return _sharedAppConfig
  }
  // Reuse cached app config from event context
  if (event.context.nitro.appConfig) {
    return event.context.nitro.appConfig
  }
  // Prepare app config for event context
  const appConfig = klona(_inlineAppConfig)
  event.context.nitro.appConfig = appConfig
  return appConfig
}

// --- Utils ---

function _deepFreeze (object: Record<string, any>) {
  const propNames = Object.getOwnPropertyNames(object)
  for (const name of propNames) {
    const value = object[name]
    if (value && typeof value === 'object') {
      _deepFreeze(value)
    }
  }
  return Object.freeze(object)
}
