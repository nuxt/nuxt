import { normalizeModuleTranspilePath, useNuxt } from '@nuxt/kit'

interface AddModuleTranspilesOptions {
  additionalModules?: string[]
}

export const addModuleTranspiles = (opts: AddModuleTranspilesOptions = {}) => {
  const nuxt = useNuxt()

  const modules: string[] = []
  const allModules = [...opts.additionalModules || [], ...nuxt.options.modules, ...nuxt.options._modules]
  for (const m of allModules) {
    const mSrc = typeof m === 'string' ? m : Array.isArray(m) ? m[0] : m.src
    if (typeof mSrc === 'string') {
      modules.push(normalizeModuleTranspilePath(mSrc))
    }
  }

  const buildTranspile = []
  for (const m of nuxt.options.build.transpile) {
    const x = typeof m === 'string' ? m.split('node_modules/').pop() : m
    if (x) {
      buildTranspile.push(x)
    }
  }
  // Try to sanitize modules to better match imports
  nuxt.options.build.transpile = buildTranspile

  function isTranspilePresent (mod: string) {
    return nuxt.options.build.transpile.some(t => !(t instanceof Function) && (t instanceof RegExp ? t.test(mod) : new RegExp(t).test(mod)))
  }

  // Automatically add used modules to the transpile
  for (const module of modules) {
    if (!isTranspilePresent(module)) {
      nuxt.options.build.transpile.push(module)
    }
  }
}
