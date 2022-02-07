import type { NuxtModule, Nuxt } from '@nuxt/schema'
import { useNuxt } from '../context'
import { resolveModule, requireModule, importModule } from '../internal/cjs'
import { resolveAlias } from '../resolve'
import { useModuleContainer } from './container'

/** Installs a module on a Nuxt instance. */
export async function installModule (nuxtModule: string | NuxtModule, inlineOptions?: any, nuxt: Nuxt = useNuxt()) {
  // Detect if `installModule` used with older signuture (nuxt, nuxtModule)
  // TODO: Remove in RC
  // @ts-ignore
  if (nuxtModule?._version || nuxtModule?.version || nuxtModule?.constructor?.version || '') {
    // @ts-ignore
    [nuxt, nuxtModule] = [nuxtModule, inlineOptions]
    inlineOptions = {}
    console.warn(new Error('`installModule` is being called with old signature!'))
  }

  // Import if input is string
  if (typeof nuxtModule === 'string') {
    const _src = resolveModule(resolveAlias(nuxtModule), { paths: nuxt.options.modulesDir })
    // TODO: also check with type: 'module' in closest `package.json`
    const isESM = _src.endsWith('.mjs')
    nuxtModule = isESM ? await importModule(_src) : requireModule(_src)
  }

  // Throw error if input is not a function
  if (typeof nuxtModule !== 'function') {
    throw new TypeError('Nuxt module should be a function: ' + nuxtModule)
  }

  // Call module
  await nuxtModule.call(useModuleContainer(), inlineOptions, nuxt)
}
