import type { Nuxt, NuxtModule } from '@nuxt/schema'
import { useNuxt } from '../context'
import { resolveModule, requireModule } from '../internal/cjs'
import { importModule } from '../internal/esm'
import { resolveAlias } from '../resolve'

/** Installs a module on a Nuxt instance. */
export async function installModule (moduleToInstall: string | NuxtModule, _inlineOptions?: any, _nuxt?: Nuxt) {
  const nuxt = useNuxt()
  const { nuxtModule, inlineOptions } = await normalizeModule(moduleToInstall, _inlineOptions)

  // Call module
  const res = await nuxtModule(inlineOptions, nuxt) ?? {}
  if (res === false /* setup aborted */) {
    return
  }

  if (typeof moduleToInstall === 'string') {
    nuxt.options.build.transpile.push(moduleToInstall)
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
