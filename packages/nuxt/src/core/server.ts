import { pathToFileURL } from 'node:url'
import { directoryToURL, getAddDependencyCommand, importModule } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { buildDiagnostics } from '@nuxt/kit/internal'

import type { Nuxt, NuxtBuilder } from 'nuxt/schema'

export async function bundleServer (nuxt: Nuxt) {
  try {
    nuxt._perf?.startPhase('server:import')
    const { bundle } = !nuxt.options.server.builder || typeof nuxt.options.server.builder === 'string'
      ? await loadServerBuilder(nuxt, nuxt.options.server.builder)
      : nuxt.options.server.builder
    nuxt._perf?.endPhase('server:import')

    nuxt._perf?.startPhase('server:setup')
    await bundle(nuxt)
    nuxt._perf?.endPhase('server:setup')
  } catch (error: any) {
    await nuxt.callHook('build:error', error)

    throw error
  }
}

async function loadServerBuilder (nuxt: Nuxt, builder = '@nuxt/nitro-server'): Promise<NuxtBuilder> {
  try {
    // prefer our own dependency tree before walking up from rootDir
    const resolved = resolveModulePath(builder, { from: import.meta.url, try: true })
    if (resolved) {
      return await import(pathToFileURL(resolved).href)
    }
    return await importModule(builder, { url: [new URL(import.meta.url), directoryToURL(nuxt.options.rootDir)] })
  } catch (err) {
    throw buildDiagnostics.NUXT_B1018({ builder, installCommand: await getAddDependencyCommand(builder, nuxt.options.rootDir, { dev: true }), cause: err })
  }
}
