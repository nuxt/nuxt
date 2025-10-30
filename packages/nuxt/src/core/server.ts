import { directoryToURL, importModule } from '@nuxt/kit'

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
    return await importModule(builder, { url: [directoryToURL(nuxt.options.rootDir), new URL(import.meta.url)] })
  } catch (err) {
    // TODO: docs
    throw new Error(`Loading \`${builder}\` server builder failed.`, { cause: err })
  }
}
