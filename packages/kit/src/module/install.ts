import { lstatSync } from 'node:fs'
import type { Nuxt, NuxtModule } from '@nuxt/schema'
import { dirname, isAbsolute, normalize, resolve } from 'pathe'
import { isNuxt2 } from '../compatibility'
import { useNuxt } from '../context'
import { requireModule } from '../internal/cjs'
import { importModule } from '../internal/esm'
import { resolveAlias } from '../resolve'

/** Installs a module on a Nuxt instance. */
export async function installModule (moduleToInstall: string | NuxtModule, _inlineOptions?: any, _nuxt?: Nuxt) {
  const nuxt = useNuxt()
  const { nuxtModule, inlineOptions } = await normalizeModule(moduleToInstall, _inlineOptions)

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
  }

  nuxt.options._installedModules = nuxt.options._installedModules || []
  nuxt.options._installedModules.push({
    meta: await nuxtModule.getMeta?.(),
    timings: res.timings,
    entryPath: typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall) : undefined
  })
}

// --- Internal ---

export const normalizeModuleTranspilePath = (p: string) => {
  try {
    // we need to target directories instead of module file paths themselves
    // /home/user/project/node_modules/module/index.js -> /home/user/project/node_modules/module
    p = isAbsolute(p) && lstatSync(p).isFile() ? dirname(p) : p
  } catch (e) {
    // maybe the path is absolute but does not exist, allow this to bubble up
  }
  return p.split('node_modules/').pop() as string
}

async function normalizeModule (nuxtModule: string | NuxtModule, inlineOptions?: any) {
  const nuxt = useNuxt()

  // Import if input is string
  if (typeof nuxtModule === 'string') {
    let src = resolveAlias(nuxtModule)
    if (src.match(/^\.{1,2}\//)) {
      src = resolve(nuxt.options.rootDir, src)
    }
    src = normalize(src)
    try {
      // Prefer ESM resolution if possible
      nuxtModule = await importModule(src, nuxt.options.modulesDir).catch(() => null) ?? requireModule(src, { paths: nuxt.options.modulesDir })
    } catch (error: unknown) {
      console.error(`Error while requiring module \`${nuxtModule}\`: ${error}`)
      throw error
    }
  }

  // Throw error if input is not a function
  if (typeof nuxtModule !== 'function') {
    throw new TypeError('Nuxt module should be a function: ' + nuxtModule)
  }

  return { nuxtModule, inlineOptions } as { nuxtModule: NuxtModule<any>, inlineOptions: undefined | Record<string, any> }
}
