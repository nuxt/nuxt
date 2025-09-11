import { normalizeModuleTranspilePath } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

export const addModuleTranspiles = (nuxt: Nuxt) => {
  // Try to sanitize modules to better match imports
  function isTranspilePresent (mod: string) {
    return nuxt.options.build.transpile
      .some(t => !(t instanceof Function) && (t instanceof RegExp ? t.test(mod) : new RegExp(t).test(mod)))
  }

  for (const m of [...nuxt.options.modules, ...nuxt.options._modules]) {
    const mod = typeof m === 'string' ? m : Array.isArray(m) ? m[0] : m.src
    if (typeof mod !== 'string') {
      continue
    }
    const path = normalizeModuleTranspilePath(mod)
    // Automatically add used modules to the transpile
    if (!isTranspilePresent(path)) {
      nuxt.options.build.transpile.push(path)
    }
  }
}
