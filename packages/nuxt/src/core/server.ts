import { directoryToURL, importModule } from '@nuxt/kit'

import type { Nuxt, NuxtBuilder } from 'nuxt/schema'
import { formatErrorMessage } from './utils/error-format.ts'

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
    throw new Error(formatErrorMessage(`Loading \`${builder}\` server builder failed.`, {
      fix: `Run \`npm install ${builder}\` to install it.`,
      docs: 'https://nuxt.com/docs/4.x/api/nuxt-config#builder-1',
      context: { builder, rootDir: nuxt.options.rootDir },
    }), { cause: err })
  }
}
