import type { Nuxt, NuxtOptions } from '@nuxt/schema'

import { bundlerDiagnostics } from '../diagnostics/bundler.ts'
import { ensureDependencyInstalled, findPackageMissingSubpath, getAddDependencyCommand } from '../dependency.ts'
import { directoryToURL, tryImportModule } from './esm.ts'

type PostcssPluginFactory<T> = (options: Record<string, any>) => T

function sortPlugins ({ plugins, order }: NuxtOptions['postcss']): string[] {
  const names = Object.keys(plugins)
  return typeof order === 'function' ? order(names) : (order || names)
}

/**
 * Load the PostCSS plugins configured with the `postcss` option, in order, offering to install missing ones.
 */
export async function resolvePostcssPlugins<T = unknown> (nuxt: Nuxt): Promise<T[]> {
  const plugins: T[] = []

  for (const pluginName of sortPlugins(nuxt.options.postcss)) {
    const pluginOptions = nuxt.options.postcss.plugins[pluginName]
    if (!pluginOptions) { continue }

    const pluginFn = await resolvePostcssPlugin<T>(pluginName, nuxt)
    if (typeof pluginFn === 'function') {
      plugins.push(pluginFn(pluginOptions))
    }
  }

  return plugins
}

async function resolvePostcssPlugin<T> (pluginName: string, nuxt: Nuxt): Promise<PostcssPluginFactory<T> | undefined> {
  const parentURLs = nuxt.options.modulesDir.map(dir => directoryToURL(dir.replace(/\/node_modules\/?$/, '')))

  const importPlugin = () => tryImportModule<PostcssPluginFactory<T>>(pluginName, { url: parentURLs })

  let pluginFn = await importPlugin()
  if (typeof pluginFn === 'function') {
    return pluginFn
  }

  const packageName = findPackageMissingSubpath(pluginName, nuxt.options.modulesDir)
  if (packageName) {
    bundlerDiagnostics.NUXT_B7027({ pluginName, packageName })
    return
  }

  const installed = await ensureDependencyInstalled(pluginName, {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
  })

  if (installed) {
    pluginFn = await importPlugin()
    if (typeof pluginFn === 'function') {
      return pluginFn
    }
  }

  bundlerDiagnostics.NUXT_B7007({ pluginName, installCommand: await getAddDependencyCommand(pluginName, nuxt.options.rootDir, { dev: true }) })
}
