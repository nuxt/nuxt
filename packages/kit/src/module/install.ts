import { existsSync, promises as fsp, lstatSync } from 'node:fs'
import type { ModuleMeta, Nuxt, NuxtModule } from '@nuxt/schema'
import { dirname, isAbsolute, join } from 'pathe'
import { defu } from 'defu'
import { isNuxt2 } from '../compatibility'
import { useNuxt } from '../context'
import { requireModule } from '../internal/cjs'
import { importModule } from '../internal/esm'
import { resolveAlias, resolvePath } from '../resolve'

/** Installs a module on a Nuxt instance. */
export async function installModule (moduleToInstall: string | NuxtModule, inlineOptions?: any, nuxt: Nuxt = useNuxt()) {
  const { nuxtModule, buildTimeModuleMeta } = await loadNuxtModuleInstance(moduleToInstall, nuxt)

  // Call module
  const res = (
    isNuxt2()
      // @ts-expect-error Nuxt 2 `moduleContainer` is not typed
      ? await nuxtModule.call(nuxt.moduleContainer, inlineOptions, nuxt)
      : await nuxtModule(inlineOptions, nuxt)
  ) ?? {}
  if (res === false /* setup aborted */) {
    return
  }

  if (typeof moduleToInstall === 'string') {
    nuxt.options.build.transpile.push(normalizeModuleTranspilePath(moduleToInstall))
    const directory = getDirectory(moduleToInstall)
    if (directory !== moduleToInstall) {
      nuxt.options.modulesDir.push(getDirectory(moduleToInstall))
    }
  }

  nuxt.options._installedModules = nuxt.options._installedModules || []
  nuxt.options._installedModules.push({
    meta: defu(await nuxtModule.getMeta?.(), buildTimeModuleMeta),
    timings: res.timings,
    entryPath: typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall) : undefined
  })
}

// --- Internal ---

function getDirectory (p: string) {
  try {
    // we need to target directories instead of module file paths themselves
    // /home/user/project/node_modules/module/index.js -> /home/user/project/node_modules/module
    return isAbsolute(p) && lstatSync(p).isFile() ? dirname(p) : p
  } catch (e) {
    // maybe the path is absolute but does not exist, allow this to bubble up
  }
  return p
}

export const normalizeModuleTranspilePath = (p: string) => {
  return getDirectory(p).split('node_modules/').pop() as string
}

export async function loadNuxtModuleInstance (nuxtModule: string | NuxtModule, nuxt: Nuxt = useNuxt()) {
  let buildTimeModuleMeta: ModuleMeta = {}
  // Import if input is string
  if (typeof nuxtModule === 'string') {
    const src = await resolvePath(nuxtModule)
    try {
      // Prefer ESM resolution if possible
      nuxtModule = await importModule(src, nuxt.options.modulesDir).catch(() => null) ?? requireModule(src, { paths: nuxt.options.modulesDir })
    } catch (error: unknown) {
      console.error(`Error while requiring module \`${nuxtModule}\`: ${error}`)
      throw error
    }
    // nuxt-module-builder generates a module.json with metadata including the version
    if (existsSync(join(dirname(src), 'module.json'))) {
      buildTimeModuleMeta = JSON.parse(await fsp.readFile(join(dirname(src), 'module.json'), 'utf-8'))
    }
  }

  // Throw error if input is not a function
  if (typeof nuxtModule !== 'function') {
    throw new TypeError('Nuxt module should be a function: ' + nuxtModule)
  }

  return { nuxtModule, buildTimeModuleMeta } as { nuxtModule: NuxtModule<any>, buildTimeModuleMeta: ModuleMeta }
}
