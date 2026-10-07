import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import type { PostCSSPlugin } from '@rsbuild/core'
import { directoryToURL, ensureDependencyInstalled, getAddDependencyCommand, tryImportModule } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'

type PostcssPluginFactory = (options: Record<string, any>) => PostCSSPlugin

function sortPlugins ({ plugins, order }: NuxtOptions['postcss']): string[] {
  const names = Object.keys(plugins)
  return typeof order === 'function' ? order(names) : (order || names)
}

/**
 * Resolve the PostCSS plugins configured with the `postcss` option.
 *
 * Vendor prefixing and minification are handled by Lightning CSS in Rsbuild,
 * so no plugins are added by default.
 */
export async function resolvePostcssPlugins (nuxt: Nuxt): Promise<PostCSSPlugin[]> {
  const plugins: PostCSSPlugin[] = []

  for (const pluginName of sortPlugins(nuxt.options.postcss)) {
    const pluginOptions = nuxt.options.postcss.plugins[pluginName]
    if (!pluginOptions) { continue }

    const pluginFn = await resolvePostcssPlugin(pluginName, nuxt)
    if (typeof pluginFn === 'function') {
      plugins.push(pluginFn(pluginOptions))
    }
  }

  return plugins
}

async function resolvePostcssPlugin (pluginName: string, nuxt: Nuxt): Promise<PostcssPluginFactory | undefined> {
  const parentURLs = nuxt.options.modulesDir.map(dir => directoryToURL(dir.replace(/\/node_modules\/?$/, '')))

  const importPlugin = () => tryImportModule<PostcssPluginFactory>(pluginName, { url: parentURLs })

  let pluginFn = await importPlugin()
  if (typeof pluginFn === 'function') {
    return pluginFn
  }

  // Plugin not found - prompt the user to install it
  const installed = await ensureDependencyInstalled(pluginName, {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
    from: import.meta.url,
  })

  if (installed) {
    pluginFn = await importPlugin()
    if (typeof pluginFn === 'function') {
      return pluginFn
    }
  }

  bundlerDiagnostics.NUXT_B7007({ pluginName, installCommand: await getAddDependencyCommand(pluginName, nuxt.options.rootDir, { dev: true }) })
}
