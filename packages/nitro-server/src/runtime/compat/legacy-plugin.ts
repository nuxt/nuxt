import { definePlugin } from 'nitro'
import type { NitroApp, NitroAppPlugin } from 'nitro/types'

import { serverDiagnostics } from '../diagnostics.ts'

type Hooks = NonNullable<NitroApp['hooks']>

const legacyApps = new WeakMap<NitroApp, NitroApp>()
const legacyHooks = new WeakMap<Hooks, Hooks>()

/**
 * The hooks as Nitro v2 exposed them, with a `callHook` that always returns a promise.
 * Registration and removal go to the hooks Nitro runs. Each `callHook` handed out keeps
 * the method it was created for, so a plugin that replaces `callHook` with one calling the
 * previous `callHook` reaches the listeners.
 */
function toLegacyHooks (hooks: Hooks): Hooks {
  let legacy = legacyHooks.get(hooks)
  if (!legacy) {
    let delegate: Hooks['callHook'] | undefined
    let callHook: Hooks['callHook'] | undefined
    legacy = new Proxy(hooks, {
      get: (target, key) => {
        if (key !== 'callHook') {
          return Reflect.get(target, key)
        }
        const current = target.callHook
        if (current !== delegate || !callHook) {
          delegate = current
          callHook = (...args) => new Promise(resolve => resolve(Reflect.apply(current, target, args)))
        }
        return callHook
      },
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

/** The app with hooks that report the first `close` listener `plugin` registers. */
function withCloseReport (nitroApp: NitroApp, plugin: string): NitroApp {
  const hooks = nitroApp.hooks
  if (!hooks) {
    return nitroApp
  }
  let reported = false
  const hook: Hooks['hook'] = (name, ...args) => {
    if (name === 'close' && !reported) {
      reported = true
      serverDiagnostics.NUXT_E8017({ plugin })
    }
    return hooks.hook(name, ...args)
  }
  const reportingHooks = new Proxy(hooks, {
    get: (target, key) => key === 'hook' ? hook : Reflect.get(target, key),
  })
  return new Proxy(nitroApp, {
    get: (target, key) => key === 'hooks' ? reportingHooks : Reflect.get(target, key),
  })
}

/**
 * Hand a plugin written for Nitro v2 the `nitroApp` it expects. `name` identifies the plugin
 * in diagnostics.
 */
export function wrapLegacyPlugin (plugin: NitroAppPlugin, name?: string): NitroAppPlugin {
  return definePlugin((nitroApp) => {
    const legacyApp = toLegacyApp(nitroApp)
    return plugin((import.meta.prerender && name ? withCloseReport(legacyApp, name) : legacyApp) as typeof nitroApp)
  })
}
