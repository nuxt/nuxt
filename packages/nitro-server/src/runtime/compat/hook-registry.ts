import { serverDiagnostics } from '../diagnostics.ts'

interface Hooks {
  hook: (name: any, fn: any) => () => void
  removeHook?: (name: any, fn: any) => void
}

/** The Nitro v2 hook names the bridge emits from the v3 `response` hook. */
export const LEGACY_RESPONSE_HOOKS = ['beforeResponse', 'afterResponse'] as const

// keyed on the hooks object rather than in module state: the renderer is bundled
// separately from the plugins, so only the shared object can carry the answer across
const kListening = Symbol.for('nuxt.compat.hook-listeners')
const kBridged = Symbol.for('nuxt.compat.hook-bridge')

type ObservedHooks = Hooks & { [kListening]?: Map<string, unknown[]>, [kBridged]?: boolean }

/** Record that the v2 response hooks will be emitted, so a listener is not warned about. */
export function markLegacyHookBridge (hooks: Hooks | undefined): void {
  if (hooks) {
    Object.defineProperty(hooks, kBridged, { value: true, configurable: true })
  }
}

/**
 * Record which hook names have a listener, by observing registrations and removals through
 * the public `hook` and `removeHook` methods (`hookOnce`, `addHooks` and the returned
 * unregister functions go through them too), since Hookable has no public way to ask. The
 * v2 hooks the compat layer emits cost a body read and a header snapshot, which an app with
 * no v2 hook should not pay.
 */
export function observeLegacyHooks (hooks: Hooks | undefined): void {
  if (!hooks || (hooks as ObservedHooks)[kListening]) {
    return
  }
  const listeners = new Map<string, unknown[]>()
  Object.defineProperty(hooks, kListening, { value: listeners, configurable: true })
  const register = hooks.hook.bind(hooks)
  const reported = new Set<string>()
  hooks.hook = (name: string, fn: (...args: any[]) => any) => {
    if (typeof fn === 'function') {
      listeners.set(name, [...listeners.get(name) ?? [], fn])
    }
    if ((LEGACY_RESPONSE_HOOKS as readonly string[]).includes(name) && !(hooks as ObservedHooks)[kBridged] && !reported.has(name)) {
      reported.add(name)
      serverDiagnostics.NUXT_E8010({ hook: name })
    }
    return register(name, fn)
  }
  const unregister = hooks.removeHook?.bind(hooks)
  if (unregister) {
    hooks.removeHook = (name: string, fn: unknown) => {
      const fns = listeners.get(name)
      const index = fns?.indexOf(fn) ?? -1
      if (index !== -1) {
        fns!.splice(index, 1)
      }
      unregister(name, fn)
    }
  }
}

export function hasLegacyHookListener (hooks: Hooks | undefined, name: string): boolean {
  return !!(hooks as ObservedHooks | undefined)?.[kListening]?.get(name)?.length
}
