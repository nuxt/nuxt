import onChange from 'on-change'
import type { Nuxt, NuxtModule, NuxtOptions } from 'nuxt/schema'

/**
 * With `experimental.debugModuleMutation`, `nuxt.options` read inside a module is an `on-change`
 * proxy recording each mutation in `nuxt._debug.moduleMutationRecords`.
 */
export function trackModuleMutations (nuxt: Nuxt, options: NuxtOptions) {
  const proxiedOptions = new WeakMap<NuxtModule, NuxtOptions>()

  Object.defineProperty(nuxt, 'options', {
    get () {
      const currentModule = nuxt._asyncLocalStorageModule!.getStore()
      if (!currentModule) {
        return options
      }

      if (proxiedOptions.has(currentModule)) {
        return proxiedOptions.get(currentModule)!
      }

      nuxt._debug ||= {}
      nuxt._debug.moduleMutationRecords ||= []

      const proxied = onChange(options, (keys, newValue, previousValue, applyData) => {
        if (newValue === previousValue && !applyData) {
          return
        }
        let value = applyData?.args ?? newValue
        if (Array.isArray(value)) {
          value = [...value]
        } else if (typeof value === 'object') {
          value = { ...(value as any) }
        }
        nuxt._debug!.moduleMutationRecords!.push({
          module: currentModule,
          keys,
          target: 'nuxt.options',
          value,
          timestamp: Date.now(),
          method: applyData?.name,
        })
      }, {
        ignoreUnderscores: true,
        ignoreSymbols: true,
        pathAsArray: true,
      })

      proxiedOptions.set(currentModule, proxied)
      return proxied
    },
  })
}

function fullyUnwrap (value: unknown): unknown {
  let current = value
  let target = onChange.target(current as Record<string, any>)
  while (target !== current) {
    current = target
    target = onChange.target(current as Record<string, any>)
  }
  return current
}

/**
 * Deeply replace any `on-change` proxies embedded in `value` with their plain targets.
 *
 * Merging helpers like `defu` copy proxied nested objects into their result, which then gets
 * written back into the real options. `on-change` only unwraps the top level of an assigned value,
 * so the nested proxies survive and break consumers that treat the resolved config as plain data
 * (e.g. `structuredClone` throwing `DataCloneError`).
 */
export function stripDebugProxies (value: unknown, seen = new WeakSet<object>()): void {
  const target = fullyUnwrap(value)
  if (target === null || typeof target !== 'object' || seen.has(target)) {
    return
  }
  seen.add(target)
  for (const key of Object.keys(target)) {
    const current = (target as Record<string, unknown>)[key]
    const unwrapped = fullyUnwrap(current)
    if (unwrapped !== current) {
      (target as Record<string, unknown>)[key] = unwrapped
    }
    stripDebugProxies(unwrapped, seen)
  }
}
