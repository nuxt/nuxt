import process from 'node:process'
import type { Nuxt } from '@nuxt/schema'
import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import type { Plugin as RsdoctorPluginTypes } from '@rsdoctor/types'
import { directoryToURL, ensureDependencyInstalled, getAddDependencyCommand, tryImportModule } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { basename, dirname, join, resolve } from 'pathe'

/**
 * Rsbuild plugins enabled when the project depends on them, as they
 * pull in the corresponding preprocessors.
 */
const preprocessorPlugins = {
  '@rsbuild/plugin-sass': 'pluginSass',
  '@rsbuild/plugin-less': 'pluginLess',
  '@rsbuild/plugin-stylus': 'pluginStylus',
  '@rsbuild/plugin-pug': 'pluginPug',
}

export async function resolvePreprocessorPlugins (nuxt: Nuxt): Promise<RsbuildPlugin[]> {
  const url = [nuxt.options.rootDir, ...nuxt.options.modulesDir].map(dir => directoryToURL(dir))

  const plugins: RsbuildPlugin[] = []
  for (const [name, exportName] of Object.entries(preprocessorPlugins)) {
    const module = await tryImportModule<Record<string, () => RsbuildPlugin>>(name, { url, interopDefault: false })
    if (module?.[exportName]) {
      plugins.push(module[exportName]())
    }
  }

  return plugins
}

export async function resolveTypeCheckPlugin (nuxt: Nuxt): Promise<RsbuildPlugin | undefined> {
  if (nuxt.options.test || !(nuxt.options.typescript.typeCheck === true || (nuxt.options.typescript.typeCheck === 'build' && !nuxt.options.dev))) {
    return
  }

  const installed = await ensureDependencyInstalled('@rsbuild/plugin-type-check', {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
    from: import.meta.url,
  })
  if (!installed) {
    bundlerDiagnostics.NUXT_B7028({ installCommand: await getAddDependencyCommand('@rsbuild/plugin-type-check', nuxt.options.rootDir, { dev: true }) })
    return
  }

  const { pluginTypeCheck } = await import('@rsbuild/plugin-type-check')
  return pluginTypeCheck()
}

/**
 * `@rsdoctor/rspack-plugin` is loaded from the project, like the preprocessor plugins. It isn't a (peer) dependency, as
 * pnpm installs optional peers in the monorepo, and its dependencies would lower the provenance of locked packages.
 */
interface RsdoctorModule {
  RsdoctorRspackPlugin: new (options: RsdoctorPluginTypes.RsdoctorWebpackPluginOptions<[]>) => Rspack.RspackPluginInstance
}

/**
 * Rsdoctor is the bundle analyzer of Rsbuild. `build.analyze` writes a single HTML report of the client build, which
 * `nuxt analyze` serves. With `RSDOCTOR=true`, Rsbuild adds Rsdoctor to each build with its data next to the output,
 * which would publish the data of the client build (including the source of modules): Nuxt adds it instead.
 */
export async function resolveRsdoctorPlugin (nuxt: Nuxt): Promise<RsbuildPlugin | undefined> {
  const analyze = nuxt.options.build.analyze
  const analyzeClient = !nuxt.options.dev && !nuxt.options.test && !!analyze && (typeof analyze !== 'object' || !!analyze.enabled)
  const rsdoctorEnv = process.env.RSDOCTOR === 'true'
  if (!analyzeClient && !rsdoctorEnv) {
    return
  }

  const installed = await ensureDependencyInstalled('@rsdoctor/rspack-plugin', {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
    from: import.meta.url,
  })
  const rsdoctor = installed
    ? await tryImportModule<RsdoctorModule>('@rsdoctor/rspack-plugin', {
        url: [...[nuxt.options.rootDir, ...nuxt.options.modulesDir].map(dir => directoryToURL(dir)), new URL(import.meta.url)],
        interopDefault: false,
      })
    : undefined
  if (!rsdoctor) {
    bundlerDiagnostics.NUXT_B7029({ installCommand: await getAddDependencyCommand('@rsdoctor/rspack-plugin', nuxt.options.rootDir, { dev: true }) })
    return
  }

  const { RsdoctorRspackPlugin } = rsdoctor
  const filename = resolve(nuxt.options.rootDir, typeof analyze === 'object' && 'filename' in analyze && analyze.filename ? analyze.filename.replace('{name}', 'client') : join(nuxt.options.analyzeDir, 'client.html'))

  return {
    name: 'nuxt:rsdoctor',
    setup (api) {
      // Rsbuild doesn't add its own `RSDOCTOR=true` plugin to builds that already have one
      api.modifyRspackConfig((config, { environment }) => {
        const brief = analyzeClient && environment.name === 'client'
        if (!brief && !rsdoctorEnv) {
          return
        }

        config.plugins ||= []
        config.plugins.push(new RsdoctorRspackPlugin({
          output: brief
            ? {
                mode: 'brief',
                reportDir: dirname(filename),
                options: {
                  type: ['html'],
                  htmlOptions: { reportHtmlName: basename(filename), writeDataJson: false },
                },
              }
            : { reportDir: resolve(nuxt.options.analyzeDir, environment.name) },
        }))
      })
    },
  }
}
