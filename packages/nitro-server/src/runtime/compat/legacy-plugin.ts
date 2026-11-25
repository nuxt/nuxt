import { definePlugin } from 'nitro'
import type { NitroApp, NitroAppPlugin } from 'nitro/types'

import { serverDiagnostics } from '../diagnostics.ts'

type Hooks = NonNullable<NitroApp['hooks']>

interface PluginSetup {
  plugin: string
  reported: boolean
}

const legacyApps = new WeakMap<NitroApp, NitroApp>()
const legacyHooks = new WeakMap<Hooks, Hooks>()

let setup: PluginSetup | undefined

function reportClose (name: unknown): void {
  if (name === 'close' && setup && !setup.reported) {
    setup.reported = true
    serverDiagnostics.NUXT_E8017({ plugin: setup.plugin })
  }
}

/**
 * The hooks as Nitro v2 exposed them, with a `callHook` that always returns a promise.
 * Registration and removal go to the hooks Nitro runs. Each `callHook` and `hook` handed
 * out keeps the method it was created for, so a plugin that replaces either with one
 * calling the previous method reaches the listeners. While prerendering, `hook` reports
 * the first `close` listener each named plugin registers during its setup.
 */
function toLegacyHooks (hooks: Hooks): Hooks {
  let legacy = legacyHooks.get(hooks)
  if (!legacy) {
    let callDelegate: Hooks['callHook'] | undefined
    let callHook: Hooks['callHook'] | undefined
    let hookDelegate: Hooks['hook'] | undefined
    let hook: Hooks['hook'] | undefined
    legacy = new Proxy(hooks, {
      get: (target, key) => {
        if (key === 'callHook') {
          const current = target.callHook
          if (current !== callDelegate || !callHook) {
            callDelegate = current
            callHook = (...args) => new Promise(resolve => resolve(Reflect.apply(current, target, args)))
          }
          return callHook
        }
        if (key === 'hook' && import.meta.prerender) {
          const current = target.hook
          if (current !== hookDelegate || !hook) {
            hookDelegate = current
            hook = (name, ...args) => {
              reportClose(name)
              return Reflect.apply(current, target, [name, ...args])
            }
          }
          return hook
        }
        return Reflect.get(target, key)
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

/**
 * Hand a plugin written for Nitro v2 the `nitroApp` it expects. `name` identifies the plugin
 * in diagnostics, which cover what it does until it returns or the promise it returns settles.
 */
export function wrapLegacyPlugin (plugin: NitroAppPlugin, name?: string): NitroAppPlugin {
  return definePlugin((nitroApp) => {
    const legacyApp = toLegacyApp(nitroApp) as typeof nitroApp
    if (!import.meta.prerender || !name) {
      return plugin(legacyApp)
    }
    const previous = setup
    const current: PluginSetup = { plugin: name, reported: false }
    setup = current
    const done = () => {
      if (setup === current) {
        setup = previous
      }
    }
    let result: ReturnType<NitroAppPlugin>
    try {
      result = plugin(legacyApp)
    } catch (error) {
      done()
      throw error
    }
    if (typeof result?.then === 'function') {
      result.then(done, done)
    } else {
      done()
    }
    return result
  })
}
