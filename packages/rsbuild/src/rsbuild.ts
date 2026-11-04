import { pathToFileURL } from 'node:url'
import type { NuxtBuilder } from '@nuxt/schema'
import type { RsbuildInstance, Rspack } from '@rsbuild/core'
import { createRsbuild } from '@rsbuild/core'
import { logger, setBuildOutput } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { resolve } from 'pathe'

import { resolveRsbuildConfig } from './config.ts'
import { setupDevServer } from './dev-server.ts'

export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  const config = await resolveRsbuildConfig(nuxt)

  // In dev the SSR entry is served from the in-memory bundle via the `rsbuild:compile` hook.
  if (nuxt.options.ssr && !nuxt.options.dev) {
    const serverEntryFile = pathToFileURL(resolve(nuxt.options.buildDir, 'dist/server/server.mjs')).href
    setBuildOutput('serverEntry', () => `export { default } from ${JSON.stringify(serverEntryFile)}`, nuxt)
  }

  await nuxt.callHook('rsbuild:config', config)

  const rsbuild = await createRsbuild({
    cwd: config.root,
    callerName: 'nuxt',
    config,
  })

  if (nuxt.options.dev) {
    await setupDevServer(nuxt, rsbuild)
    return
  }

  await build(rsbuild)
}

async function build (rsbuild: RsbuildInstance) {
  const failures: Array<{ name: string, stats: Rspack.Stats }> = []
  rsbuild.onAfterEnvironmentCompile(({ environment, stats }) => {
    if (stats?.hasErrors()) {
      failures.push({ name: environment.name, stats })
    }
  })

  try {
    const { close } = await rsbuild.build()
    await close()
  } catch (error) {
    if (!failures.length) {
      throw error
    }

    for (const { stats } of failures) {
      // eslint-disable-next-line no-restricted-syntax -- raw compiler output; the diagnostic below carries the errors as `cause`
      logger.error(stats.toString({ errors: true, warnings: false, colors: false, errorDetails: true }))
    }
    throw bundlerDiagnostics.NUXT_B7032({ name: failures[0]!.name, cause: failures.flatMap(({ stats }) => stats.compilation.errors) })
  }
}
