import type { Nuxt } from '@nuxt/schema'
import { startBuildEnvironment } from '@nuxt/kit/internal'
import type { BuildEnvironmentReport } from '@nuxt/kit/internal'
import { dirname, resolve } from 'pathe'
import type { Environment, Plugin } from 'vite'

/**
 * Report every environment of a production build through the `build:environment:*` hooks,
 * including environments the server builder or a deploy target adds.
 */
export function BuildReportPlugin (nuxt: Nuxt): Plugin {
  const reports = new WeakMap<Environment, Promise<BuildEnvironmentReport>>()

  return {
    name: 'nuxt:build-report',
    apply: () => !nuxt.options.dev,
    async buildStart () {
      const environment = this.environment
      if (environment.config.build.write === false) { return }
      const report = startBuildEnvironment({
        name: environment.name,
        consumer: environment.config.consumer,
        builder: 'vite',
      }, nuxt)
      reports.set(environment, report)
      await report
    },
    writeBundle: {
      order: 'post',
      async handler (options, bundle) {
        const environment = this.environment
        const report = reports.get(environment)
        if (!report) { return }
        reports.delete(environment)

        const { root, build } = environment.config
        const outDir = resolve(root, options.dir ?? (options.file ? dirname(options.file) : build.outDir))
        const files = new Set<string>()
        for (const file of Object.values(bundle)) {
          files.add(file.fileName)
          if (file.type === 'chunk' && file.sourcemapFileName) {
            files.add(file.sourcemapFileName)
          }
        }
        await (await report).done(outDir, files)
      },
    },
  }
}
