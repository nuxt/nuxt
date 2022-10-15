import type { Nuxt, NuxtModule } from '@nuxt/schema'
import { useNuxt } from '../context'
import { resolveModule, requireModule, importModule } from '../internal/cjs'
import { resolveAlias } from '../resolve'
import { useModuleContainer } from './container'

/** Installs a module on a Nuxt instance. */
export async function installModule (moduleToInstall: string | NuxtModule, _inlineOptions?: any, _nuxt?: Nuxt) {
  const nuxt = useNuxt()
  const { nuxtModule, inlineOptions } = await normalizeModule(moduleToInstall, _inlineOptions)

  // Call module
  await nuxtModule.call(
    // Provide this context for backwards compatibility with Nuxt 2
    useModuleContainer() as any,
    inlineOptions,
    nuxt
  )

  nuxt.options._installedModules = nuxt.options._installedModules || []
  nuxt.options._installedModules.push({
    meta: await nuxtModule.getMeta?.(),
    entryPath: typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall) : undefined
  })
}

// --- Internal ---

async function normalizeModule (nuxtModule: string | NuxtModule, inlineOptions?: any) {
  const nuxt = useNuxt()

  // Detect if `installModule` used with older signuture (nuxt, nuxtModule)
  // TODO: Remove in RC
  // @ts-ignore
  if (nuxtModule?._version || nuxtModule?.version || nuxtModule?.constructor?.version || '') {
    [nuxtModule, inlineOptions] = [inlineOptions, {}]
    console.warn(new Error('`installModule` is being called with old signature!'))
  }

  // Import if input is string
  if (typeof nuxtModule === 'string') {
    const _src = resolveModule(resolveAlias(nuxtModule), { paths: nuxt.options.modulesDir })
    // TODO: also check with type: 'module' in closest `package.json`
    const isESM = _src.endsWith('.mjs')

    try {
      nuxtModule = isESM ? await importModule(_src) : requireModule(_src)
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
