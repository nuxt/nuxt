import type { Nuxt } from '@nuxt/schema'
import { startBuildEnvironment } from '@nuxt/kit/internal'
import type { BuildEnvironmentReport } from '@nuxt/kit/internal'
import { dirname, join, relative, resolve } from 'pathe'
import type { Environment, Plugin } from 'vite'

interface EnvironmentReport {
  report: Promise<BuildEnvironmentReport>
  /** Outputs still to be written: an environment writes each configured output in turn. */
  remaining: number
  outDirs: Set<string>
  files: Set<string>
}

function countOutputs (build: Environment['config']['build']): number {
  const output = build.rolldownOptions.output
  if (Array.isArray(output)) {
    return Math.max(output.length, 1)
  }
  // a library build writes one output per format, and two by default
  return build.lib ? build.lib.formats?.length || 2 : 1
}

/**
 * Report every environment of a production build through the `build:environment:*` hooks,
 * including environments the server builder or a deploy target adds.
 */
export function BuildReportPlugin (nuxt: Nuxt): Plugin {
  const reports = new WeakMap<Environment, EnvironmentReport>()

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
      reports.set(environment, {
        report,
        remaining: countOutputs(environment.config.build),
        outDirs: new Set(),
        files: new Set(),
      })
      await report
    },
    writeBundle: {
      order: 'post',
      async handler (options, bundle) {
        const environment = this.environment
        const state = reports.get(environment)
        if (!state) { return }

        const { root, build } = environment.config
        const dir = resolve(root, options.dir ?? (options.file ? dirname(options.file) : build.outDir))
        state.outDirs.add(dir)
        for (const file of Object.values(bundle)) {
          state.files.add(join(dir, file.fileName))
          if (file.type === 'chunk' && file.sourcemapFileName) {
            state.files.add(join(dir, file.sourcemapFileName))
          }
        }

        if (--state.remaining > 0) { return }
        reports.delete(environment)

        const outDir = state.outDirs.size === 1 ? dir : resolve(root, build.outDir)
        await (await state.report).done(outDir, [...state.files].map(file => relative(outDir, file)))
      },
    },
  }
}
