import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'

import { resolveModulePath } from 'exsolve'
import { bundlerDiagnostics } from '../diagnostics/bundler.ts'
import { DEFAULT_JS_FILE_EXTENSIONS } from '../constants.ts'
import { ensureDependencyInstalled, findPackageMissingSubpath, getAddDependencyCommand, isPackageSpecifier } from '../dependency.ts'
import { resolveAlias } from '../resolve.ts'
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

/**
 * Resolve the PostCSS plugin `pluginName` from `from`, falling back to CommonJS resolution for
 * directory subpaths of packages without `exports`, such as `tailwindcss/nesting` in tailwindcss v3.
 *
 * Failed lookups are not cached, so a plugin installed since the last call is found.
 */
export function resolvePostcssPluginPath (pluginName: string, from: URL[]): string | undefined {
  const path = resolveModulePath(pluginName, { from, extensions: DEFAULT_JS_FILE_EXTENSIONS, try: true, cache: false })
  if (path) {
    return path
  }
  try {
    return createRequire(import.meta.url).resolve(pluginName, { paths: from.map(url => fileURLToPath(url)) })
  } catch {
    return undefined
  }
}

async function resolvePostcssPlugin<T> (pluginName: string, nuxt: Nuxt): Promise<PostcssPluginFactory<T> | undefined> {
  const parentURLs = nuxt.options.modulesDir.map(dir => directoryToURL(dir.replace(/\/node_modules\/?$/, '')))

  const importPlugin = (path: string | undefined) => path ? tryImportModule<PostcssPluginFactory<T>>(path) : undefined

  const specifier = resolveAlias(pluginName, nuxt.options.alias)
  const pluginPath = resolvePostcssPluginPath(specifier, parentURLs)
  let pluginFn = await importPlugin(pluginPath)
  if (typeof pluginFn === 'function') {
    return pluginFn
  }

  if (!isPackageSpecifier(specifier)) {
    bundlerDiagnostics.NUXT_B7007({ pluginName })
    return
  }

  const packageName = pluginPath ? undefined : findPackageMissingSubpath(specifier, nuxt.options.modulesDir)
  if (packageName) {
    bundlerDiagnostics.NUXT_B7027({ pluginName, packageName })
    return
  }

  await ensureDependencyInstalled(specifier, {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
  })

  pluginFn = await importPlugin(resolvePostcssPluginPath(specifier, parentURLs))
  if (typeof pluginFn === 'function') {
    return pluginFn
  }

  bundlerDiagnostics.NUXT_B7007({ pluginName, installCommand: await getAddDependencyCommand(specifier, nuxt.options.rootDir, { dev: true }) })
}
