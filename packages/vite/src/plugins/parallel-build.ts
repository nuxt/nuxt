import type { Nuxt } from '@nuxt/schema'
import { buildClientAndServer } from '@nuxt/kit/internal'
import type { BuildEnvironment, Plugin } from 'vite'

/**
 * Build the client and ssr environments concurrently. Server build hooks that read
 * client build state wait for it with `waitForClientBuild()`.
 */
export function ParallelBuildPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:parallel-build',
    apply: () => !nuxt.options.dev && nuxt.options.experimental.parallelBuild,
    buildApp: {
      // `post` runs after the client build cache is restored and, as this plugin is
      // registered ahead of `nitro/vite`, before nitro builds the remaining environments
      order: 'post',
      async handler (builder) {
        const { client, ssr } = builder.environments
        if (!client || !ssr || !needsBuild(client) || !needsBuild(ssr)) { return }

        await buildClientAndServer(builder, client, ssr, nuxt)
      },
    },
  }
}

function needsBuild (environment: BuildEnvironment) {
  return !environment.isBuilt && !!environment.config.build.rolldownOptions.input
}
