import { resolve } from 'pathe'
import { normalizeModuleTranspilePath, resolveFiles, resolveModuleWithOptions } from '@nuxt/kit'
import type { Nuxt, NuxtModule } from '@nuxt/schema'
import escapeStringRegexp from 'escape-string-regexp'

export const addModuleTranspiles = (nuxt: Nuxt) => {
  // Try to sanitize modules to better match imports
  const transpile: RegExp[] = []
  for (const t of nuxt.options.build.transpile) {
    if (t instanceof Function) {
      continue
    }
    if (typeof t === 'string') {
      transpile.push(new RegExp(escapeStringRegexp(t)))
    } else {
      transpile.push(t)
    }
  }

  for (const m of [...nuxt.options.modules, ...nuxt.options._modules]) {
    const mod = typeof m === 'string' ? m : Array.isArray(m) ? m[0] : m.src
    if (typeof mod !== 'string') {
      continue
    }
    const path = normalizeModuleTranspilePath(mod)
    // Automatically add used modules to the transpile
    if (!transpile.some(t => t.test(path))) {
      nuxt.options.build.transpile.push(path)
    }
  }
}

/**
 * Collect the modules to install: each layer's `modules` and `modules/` directory (extended
 * layers first, the project last), then modules added to `nuxt.options` after config loading.
 */
export async function resolveModules (nuxt: Nuxt) {
  const modules = new Map<string | NuxtModule, Record<string, any>>()
  const paths = new Set<string>()
  const resolvedModulePaths = new Set<string>()

  const register = (module: Parameters<typeof resolveModuleWithOptions>[0], skipRegistered: boolean) => {
    const resolvedModule = resolveModuleWithOptions(module, nuxt)
    if (!resolvedModule || (skipRegistered && modules.has(resolvedModule.module)) || (resolvedModule.resolvedPath && resolvedModulePaths.has(resolvedModule.resolvedPath))) {
      return
    }
    modules.set(resolvedModule.module, resolvedModule.options)
    const path = resolvedModule.resolvedPath || resolvedModule.module
    if (typeof path === 'string') {
      resolvedModulePaths.add(path)
    }
  }

  for (const config of nuxt.options._layers.map(layer => layer.config).reverse()) {
    for (const module of config.modules ?? []) {
      register(module, false)
    }

    const modulesDir = resolve(config.srcDir, (config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : config.dir)?.modules || 'modules')
    const layerModules = await resolveFiles(modulesDir, [
      `*{${nuxt.options.extensions.join(',')}}`,
      `*/index{${nuxt.options.extensions.join(',')}}`,
    ])

    for (const module of layerModules) {
      paths.add(module)
      if (!modules.has(module)) {
        modules.set(module, {})
      }
    }
  }

  for (const module of [...nuxt.options.modules, ...nuxt.options._modules]) {
    register(module, true)
  }

  return {
    paths,
    resolvedModulePaths,
    modules,
  }
}
