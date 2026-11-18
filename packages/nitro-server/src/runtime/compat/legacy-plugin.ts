import { definePlugin } from 'nitro'
import type { NitroApp, NitroAppPlugin } from 'nitro/types'

type Hooks = NonNullable<NitroApp['hooks']>

const legacyApps = new WeakMap<NitroApp, NitroApp>()
const legacyHooks = new WeakMap<Hooks, Hooks>()

/**
 * The hooks as Nitro v2 exposed them, with a `callHook` that always returns a promise.
 * Registration and removal go to the hooks Nitro runs.
 */
function toLegacyHooks (hooks: Hooks): Hooks {
  let legacy = legacyHooks.get(hooks)
  if (!legacy) {
    const callHook: Hooks['callHook'] = (...args) => new Promise(resolve => resolve(hooks.callHook(...args)))
    legacy = new Proxy(hooks, {
      get: (target, key) => key === 'callHook' ? callHook : Reflect.get(target, key),
    })
    legacyHooks.set(hooks, legacy)
  }
  return legacy
}

/** The `nitroApp` as Nitro v2 code sees it, the same object for every caller. */
export function toLegacyApp (nitroApp: NitroApp): NitroApp {
  let legacy = legacyApps.get(nitroApp)
  if (!legacy) {
    legacy = new Proxy(nitroApp, {
      get: (target, key) => {
        const value = Reflect.get(target, key)
        return key === 'hooks' && value ? toLegacyHooks(value) : value
      },
    })
    legacyApps.set(nitroApp, legacy)
  }
  return legacy
}

/** Hand a plugin written for Nitro v2 the `nitroApp` it expects. */
export function wrapLegacyPlugin (plugin: NitroAppPlugin): NitroAppPlugin {
  return definePlugin(nitroApp => plugin(toLegacyApp(nitroApp) as typeof nitroApp))
}
