import type { Nuxt } from '@nuxt/schema'
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
        }
      },
    },
  }
}

function needsBuild (environment: BuildEnvironment) {
  return !environment.isBuilt && !!environment.config.build.rolldownOptions.input
}
