import process from 'node:process'
import type { Nuxt } from '@nuxt/schema'
import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import type { Plugin as RsdoctorPluginTypes } from '@rsdoctor/types'
import { directoryToURL, ensureDependencyInstalled, getAddDependencyCommand, importModule, tryImportModule, tryResolveModule } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { basename, dirname, extname, join, relative, resolve } from 'pathe'

/**
 * Rsbuild plugins enabled when the project depends on them, as they
 * pull in the corresponding preprocessors.
 */
const preprocessorPlugins = [
  { packageName: '@rsbuild/plugin-sass', exportName: 'pluginSass', langs: ['scss', 'sass'] },
  { packageName: '@rsbuild/plugin-less', exportName: 'pluginLess', langs: ['less'] },
  { packageName: '@rsbuild/plugin-stylus', exportName: 'pluginStylus', langs: ['styl', 'stylus'] },
  { packageName: '@rsbuild/plugin-pug', exportName: 'pluginPug', langs: ['pug'] },
]

/** Locations searched for a package installed in the project, or alongside the builder. */
function projectURLs (nuxt: Nuxt) {
  return [...[nuxt.options.rootDir, ...nuxt.options.modulesDir].map(dir => directoryToURL(dir)), new URL(import.meta.url)]
}

/** Import a package installed in the project, or alongside the builder. */
function importFromProject<T> (nuxt: Nuxt, name: string) {
  return tryImportModule<T>(name, {
    url: projectURLs(nuxt),
    interopDefault: false,
  })
}

export async function resolvePreprocessorPlugins (nuxt: Nuxt): Promise<RsbuildPlugin[]> {
  const plugins: RsbuildPlugin[] = []
  const missing = new Map<string, string>()
  for (const { packageName, exportName, langs } of preprocessorPlugins) {
    const url = projectURLs(nuxt)
    if (!await tryResolveModule(packageName, url)) {
      for (const lang of langs) {
        missing.set(lang, packageName)
      }
      continue
    }
    const module = await importModule<Record<string, () => RsbuildPlugin>>(packageName, { url, interopDefault: false }).catch((cause) => {
      throw bundlerDiagnostics.NUXT_B7035({ packageName, exportName, cause })
    })
    if (!module[exportName]) {
      throw bundlerDiagnostics.NUXT_B7035({ packageName, exportName })
    }
    plugins.push(module[exportName]())
  }

  if (missing.size) {
    plugins.push(MissingPreprocessorPlugin(nuxt, missing))
  }

  return plugins
}

/**
 * Offer to install the Rsbuild plugin for files and SFC blocks written in a language whose
 * plugin is not installed, and fail their compilation when it is not installed.
 */
function MissingPreprocessorPlugin (nuxt: Nuxt, missing: Map<string, string>): RsbuildPlugin {
  const langs = [...missing.keys()].join('|')
  const langQueryRE = new RegExp(`[?&]lang=(${langs})(?:&|$)`)

  return {
    name: 'nuxt:missing-preprocessor',
    setup (api) {
      const installs = new Map<string, Promise<void>>()
      const ensureInstalled = (lang: string, resourcePath: string) => {
        const packageName = missing.get(lang)!
        let install = installs.get(packageName)
        if (!install) {
          install = installPreprocessorPlugin(nuxt, { packageName, lang, file: relative(nuxt.options.rootDir, resourcePath) })
          installs.set(packageName, install)
        }
        return install
      }

      // SFC blocks are requested with inline loaders, which only keep `post` rules
      api.transform({ test: /\.vue$/, resourceQuery: langQueryRE, order: 'post' }, async ({ code, resourcePath, resourceQuery }) => {
        await ensureInstalled(resourceQuery.match(langQueryRE)![1]!, resourcePath)
        return code
      })
      api.transform({ test: new RegExp(`\\.(?:${langs})$`) }, async ({ code, resourcePath }) => {
        await ensureInstalled(extname(resourcePath).slice(1), resourcePath)
        return code
      })
    },
  }
}

async function installPreprocessorPlugin (nuxt: Nuxt, { packageName, lang, file }: { packageName: string, lang: string, file: string }) {
  const installed = await ensureDependencyInstalled(packageName, {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
    from: import.meta.url,
  })
  if (!installed) {
    throw bundlerDiagnostics.NUXT_B7033({
      file,
      lang,
      packageName,
      installCommand: await getAddDependencyCommand(packageName, nuxt.options.rootDir, { dev: true }),
    })
  }
  // Rsbuild plugins are applied when the build starts
  if (nuxt.options.dev) {
    void nuxt.callHook('restart', { hard: true })
    return
  }
  throw bundlerDiagnostics.NUXT_B7034({ file, packageName })
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
  const typeCheck = installed ? await importFromProject<typeof import('@rsbuild/plugin-type-check')>(nuxt, '@rsbuild/plugin-type-check') : undefined
  if (!typeCheck) {
    bundlerDiagnostics.NUXT_B7030({ installCommand: await getAddDependencyCommand('@rsbuild/plugin-type-check', nuxt.options.rootDir, { dev: true }) })
    return
  }

  return typeCheck.pluginTypeCheck()
}

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
  const rsdoctor = installed ? await importFromProject<RsdoctorModule>(nuxt, '@rsdoctor/rspack-plugin') : undefined
  if (!rsdoctor) {
    bundlerDiagnostics.NUXT_B7031({ installCommand: await getAddDependencyCommand('@rsdoctor/rspack-plugin', nuxt.options.rootDir, { dev: true }) })
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
