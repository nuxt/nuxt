import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { normalize } from 'pathe'
import type { NuxtPlugin, NuxtPluginTemplate } from '@nuxt/schema'
import { resolvePathSync } from 'mlly'
import { isWindows } from 'std-env'
import { MODE_RE, filterInPlace } from './utils'
import { tryUseNuxt, useNuxt } from './context'
import { addTemplate } from './template'
import { resolveAlias } from './resolve'

/**
 * Normalize a nuxt plugin object
 */
const pluginSymbol = Symbol.for('nuxt plugin')
export function normalizePlugin (plugin: NuxtPlugin | string): NuxtPlugin {
  // Normalize src
  if (typeof plugin === 'string') {
    plugin = { src: plugin }
  } else {
    plugin = { ...plugin }
  }

  if (pluginSymbol in plugin) {
    return plugin
  }

  if (!plugin.src) {
    throw new Error('Invalid plugin. src option is required: ' + JSON.stringify(plugin))
  }

  // Normalize full path to plugin
  plugin.src = normalize(resolveAlias(plugin.src))

  if (!existsSync(plugin.src) && isAbsolute(plugin.src)) {
    try {
      plugin.src = resolvePathSync(isWindows ? pathToFileURL(plugin.src).href : plugin.src, { extensions: tryUseNuxt()?.options.extensions })
    } catch {
      // ignore errors as the file may be in the nuxt vfs
    }
  }

  // Normalize mode
  if (plugin.ssr) {
    plugin.mode = 'server'
  }
  if (!plugin.mode) {
    const [, mode = 'all'] = plugin.src.match(MODE_RE) || []
    plugin.mode = mode as 'all' | 'client' | 'server'
  }

  // @ts-expect-error not adding symbol to types to avoid conflicts
  plugin[pluginSymbol] = true

  return plugin
}

/**
 * Registers a nuxt plugin and to the plugins array.
 *
 * Note: You can use mode or .client and .server modifiers with fileName option
 * to use plugin only in client or server side.
 *
 * Note: By default plugin is prepended to the plugins array. You can use second argument to append (push) instead.
 * @example
 * ```js
 * import { createResolver } from '@nuxt/kit'
 * const resolver = createResolver(import.meta.url)
 *
 * addPlugin({
 *   src: resolver.resolve('templates/foo.js'),
 *   filename: 'foo.server.js' // [optional] only include in server bundle
 * })
 * ```
 */
export interface AddPluginOptions { append?: boolean }
export function addPlugin (_plugin: NuxtPlugin | string, opts: AddPluginOptions = {}) {
  const nuxt = useNuxt()

  // Normalize plugin
  const plugin = normalizePlugin(_plugin)

  // Remove any existing plugin with the same src
  filterInPlace(nuxt.options.plugins, p => normalizePlugin(p).src !== plugin.src)

  // Prepend to array by default to be before user provided plugins since is usually used by modules
  nuxt.options.plugins[opts.append ? 'push' : 'unshift'](plugin)

  return plugin
}

/**
 * Adds a template and registers as a nuxt plugin.
 */
export function addPluginTemplate (plugin: NuxtPluginTemplate | string, opts: AddPluginOptions = {}): NuxtPlugin {
  const normalizedPlugin: NuxtPlugin = typeof plugin === 'string'
    ? { src: plugin }
    // Update plugin src to template destination
    : { ...plugin, src: addTemplate(plugin).dst! }

  return addPlugin(normalizedPlugin, opts)
}
