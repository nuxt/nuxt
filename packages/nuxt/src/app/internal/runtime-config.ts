import { appDiagnostics } from '../diagnostics/core'
import { getUserTrace } from '../utils'

const loggedMutations = new Set<string>()

function isWrappable (val: unknown): val is object {
  if (!val || typeof val !== 'object') { return false }
  const prototype = Object.getPrototypeOf(val)
  return Array.isArray(val) || prototype === Object.prototype || prototype === null
}

/**
 * Reports writes to the server runtime config, which is shared by every request.
 * Only call this behind `import.meta.dev && import.meta.server`.
 */
export function guardedServerConfig (runtimeConfig: Record<string, unknown>): Record<string, unknown> {
  const proxies = new WeakMap<object, unknown>()

  const report = (path: string) => {
    if (loggedMutations.has(path)) { return }
    loggedMutations.add(path)
    const trace = getUserTrace().map(({ source, line, column }) => `at ${source}:${line}:${column}`).join('\n')
    appDiagnostics.NUXT_E1014({ key: path, trace })
  }

  const wrap = (target: object, path: string): unknown => {
    if (Object.isFrozen(target)) { return target }
    const cached = proxies.get(target)
    if (cached) { return cached }

    const keyPath = (p: string | symbol) => path ? `${path}.${String(p)}` : String(p)
    const mutationPath = Array.isArray(target) ? () => path : keyPath
    const proxy = new Proxy(target, {
      get (target, p, receiver) {
        const value = Reflect.get(target, p, receiver)
        const descriptor = Reflect.getOwnPropertyDescriptor(target, p)
        if (descriptor && !descriptor.configurable && !descriptor.writable) { return value }
        return isWrappable(value) ? wrap(value, keyPath(p)) : value
      },
      defineProperty (target, p, descriptor) {
        report(mutationPath(p))
        return Reflect.defineProperty(target, p, descriptor)
      },
      deleteProperty (target, p) {
        report(mutationPath(p))
        return Reflect.deleteProperty(target, p)
      },
    })

    proxies.set(target, proxy)
    return proxy
  }

  return wrap(runtimeConfig, '') as Record<string, unknown>
}
