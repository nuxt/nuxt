import { logger } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { BuildEnvironment, ViteBuilder } from 'vite'

/**
 * Whether an environment is still to be built. A server builder may bring its own orchestration
 * and build environments from its own `buildApp` hook, which is ordered `pre` and so runs first.
 */
export function needsBuild (environment: BuildEnvironment): boolean {
  const { input, build } = environment.config
  return !environment.isBuilt && !!(input || build.rolldownOptions.input || build.lib || typeof build.ssr === 'string')
}

/**
 * Build the client and ssr environments concurrently. Server build hooks that read
 * client build state wait for it with `waitForClientBuild()`.
 */
export async function buildConcurrently (nuxt: Nuxt, builder: ViteBuilder, client: BuildEnvironment, ssr: BuildEnvironment): Promise<void> {
  logger.restoreAll()
  const clientBuild = builder.build(client)
  const clientBuilt = clientBuild.then(() => {})
  clientBuilt.catch(() => {})
  nuxt._clientBuild = clientBuilt
  try {
    const results = await Promise.allSettled([clientBuild, builder.build(ssr)])
    for (const result of results) {
      if (result.status === 'rejected') { throw result.reason }
    }
  } finally {
    nuxt._clientBuild = undefined
    logger.wrapAll()
  }
  // once per environment, as when they are built one after the other
  await nuxt.callHook('vite:compiled')
  await nuxt.callHook('vite:compiled')
}
