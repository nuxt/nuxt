import { pathToFileURL } from 'node:url'
import { directoryToURL, getAddDependencyCommand, importModule } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { DEFAULT_JS_FILE_EXTENSIONS, buildDiagnostics } from '@nuxt/kit/internal'

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

const NITRO_SERVER_BUILDER = '@nuxt/nitro-server'
const NITRO_V3_SERVER_BUILDER = '@nuxt/nitro-v3-server'

/** The package implementing the configured server builder for the nitro major the project runs. */
export function resolveServerBuilderPackage (nuxt: Nuxt, builder: string = NITRO_SERVER_BUILDER): string {
  return builder === NITRO_SERVER_BUILDER && nuxt.options._nitroMajor === 3 ? NITRO_V3_SERVER_BUILDER : builder
}

async function loadServerBuilder (nuxt: Nuxt, configured?: string): Promise<NuxtBuilder> {
  const builder = resolveServerBuilderPackage(nuxt, configured)
  // prefer our own dependency tree before walking up from rootDir
  const resolved = resolveModulePath(builder, { from: import.meta.url, try: true })
  // importModule below resolves with these extensions, so the probe has to as well
  const installed = !!resolved || !!resolveModulePath(builder, { from: [new URL(import.meta.url), directoryToURL(nuxt.options.rootDir)], extensions: DEFAULT_JS_FILE_EXTENSIONS, try: true })
  try {
    if (resolved) {
      return await import(pathToFileURL(resolved).href)
    }
    return await importModule(builder, { url: [new URL(import.meta.url), directoryToURL(nuxt.options.rootDir)] })
  } catch (err) {
    throw buildDiagnostics.NUXT_B1018({
      builder,
      installed,
      error: err instanceof Error ? err.message : String(err),
      installCommand: await getAddDependencyCommand(builder, nuxt.options.rootDir, { dev: true }),
      cause: err,
    }, { method: 'error' })
  }
}
