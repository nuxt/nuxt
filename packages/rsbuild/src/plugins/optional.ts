import type { Nuxt } from '@nuxt/schema'
import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { directoryToURL, ensureDependencyInstalled, getAddDependencyCommand, tryImportModule } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { resolve } from 'pathe'

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

export async function resolveAnalyzePlugin (nuxt: Nuxt): Promise<RsbuildPlugin | undefined> {
  const analyze = nuxt.options.build.analyze
  if (nuxt.options.dev || nuxt.options.test || !analyze || (typeof analyze === 'object' && !analyze.enabled)) {
    return
  }

  const installed = await ensureDependencyInstalled('webpack-bundle-analyzer', {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
    from: import.meta.url,
  })
  if (!installed) {
    bundlerDiagnostics.NUXT_B7029({ installCommand: await getAddDependencyCommand('webpack-bundle-analyzer', nuxt.options.rootDir, { dev: true }) })
    return
  }

  const { BundleAnalyzerPlugin } = await import('webpack-bundle-analyzer')
  const statsDir = resolve(nuxt.options.analyzeDir)

  return {
    name: 'nuxt:analyze',
    setup (api) {
      // Rsbuild has no built-in bundle analyzer: use the Rspack-compatible `webpack-bundle-analyzer` plugin
      api.modifyRspackConfig((config) => {
        config.plugins ||= []
        config.plugins.push(new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          defaultSizes: 'gzip',
          generateStatsFile: true,
          openAnalyzer: true,
          reportFilename: resolve(statsDir, 'client.html'),
          statsFilename: resolve(statsDir, 'client.json'),
        }) as unknown as Rspack.RspackPluginInstance)
      })
    },
  }
}
