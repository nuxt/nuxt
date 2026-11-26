import { consola } from 'consola'
import { vi } from 'vitest'

consola.mockTypes(() => vi.fn())

// vue-router reads the Vue feature flags a bundler defines
;(globalThis as Record<string, unknown>).__VUE_OPTIONS_API__ ??= true
;(globalThis as Record<string, unknown>).__VUE_PROD_DEVTOOLS__ ??= false

const _warn = console.warn.bind(console)

const hiddenWarns = [
  '[Vue warn]: Component',
  '[Vue router warn]',
]

console.warn = (arg0: any, ...args: any[]) => {
  if ((typeof arg0 === 'string') && hiddenWarns.some(w => arg0.includes(w))) {
    return
  }
  _warn(arg0, ...args)
}
