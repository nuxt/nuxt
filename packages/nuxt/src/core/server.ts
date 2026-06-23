import { buildDiagnostics, directoryToURL, importModule } from '@nuxt/kit'

import type { Nuxt, NuxtBuilder } from 'nuxt/schema'

export async function bundleServer (nuxt: Nuxt) {
  try {
    const { bundle } = !nuxt.options.server.builder || typeof nuxt.options.server.builder === 'string'
      ? await loadServerBuilder(nuxt, nuxt.options.server.builder)
      : nuxt.options.server.builder

    await bundle(nuxt)
  } catch (error: any) {
    await nuxt.callHook('build:error', error)

    throw error
  }
}

async function loadServerBuilder (nuxt: Nuxt, builder = '@nuxt/nitro-server'): Promise<NuxtBuilder> {
  try {
    // prefer our own dependency tree before walking up from rootDir
    if (builder === '@nuxt/nitro-server') {
      return await import(builder)
    }
    return await importModule(builder, { url: [new URL(import.meta.url), directoryToURL(nuxt.options.rootDir)] })
  } catch (err) {
    throw buildDiagnostics.NUXT_B1018({ builder, cause: err })
  }
}
