import type { Nuxt, NuxtModule } from '@nuxt/schema'
import { dirname, isAbsolute } from 'pathe'
import { isNuxt2 } from '../compatibility'
import { useNuxt } from '../context'
import { requireModule, resolveModule } from '../internal/cjs'
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
    // When the module to install is a path to a file, we need the base directory
    // i.e /node_modules/module/dist/module.mjs -> /node_modules/module/dist/
    const moduleDir = isAbsolute(moduleToInstall) ? dirname(moduleToInstall) : moduleToInstall
    nuxt.options.build.transpile.push(moduleDir)
  }

  nuxt.options._installedModules = nuxt.options._installedModules || []
  nuxt.options._installedModules.push({
    meta: await nuxtModule.getMeta?.(),
    timings: res.timings,
    entryPath: typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall) : undefined
  })
}

// --- Internal ---

async function normalizeModule (nuxtModule: string | NuxtModule, inlineOptions?: any) {
  const nuxt = useNuxt()

  // Import if input is string
  if (typeof nuxtModule === 'string') {
    const _src = resolveModule(resolveAlias(nuxtModule), { paths: nuxt.options.modulesDir })
    // TODO: also check with type: 'module' in closest `package.json`
    const isESM = _src.endsWith('.mjs')

    try {
      nuxtModule = isESM ? await importModule(_src, nuxt.options.rootDir) : requireModule(_src)
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
