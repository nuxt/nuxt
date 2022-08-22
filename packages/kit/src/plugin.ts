import { normalize } from 'pathe'
import type { NuxtPlugin, NuxtPluginTemplate } from '@nuxt/schema'
import { useNuxt } from './context'
import { addTemplate } from './template'
import { resolveAlias } from './resolve'

/**
 * Normalize a nuxt plugin object
 */
export function normalizePlugin (plugin: NuxtPlugin | string): NuxtPlugin {
  // Normalize src
  if (typeof plugin === 'string') {
    plugin = { src: plugin }
  } else {
    plugin = { ...plugin }
  }

  if (!plugin.src) {
    throw new Error('Invalid plugin. src option is required: ' + JSON.stringify(plugin))
  }

  // Normalize full path to plugin
  plugin.src = normalize(resolveAlias(plugin.src))

  // Normalize mode
  if (plugin.ssr) {
    plugin.mode = 'server'
  }
  if (!plugin.mode) {
    const [, mode = 'all'] = plugin.src.match(/\.(server|client)(\.\w+)*$/) || []
    plugin.mode = mode as 'all' | 'client' | 'server'
  }

  return plugin
}

/**
 * Registers a nuxt plugin and to the plugins array.
 *
 * Note: You can use mode or .client and .server modifiers with fileName option
 * to use plugin only in client or server side.
 *
 * Note: By default plugin is prepended to the plugins array. You can use second argument to append (push) instead.
 *
 * @example
 * ```js
 * addPlugin({
 *   src: path.resolve(__dirname, 'templates/foo.js'),
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
  nuxt.options.plugins = nuxt.options.plugins.filter(p => normalizePlugin(p).src !== plugin.src)

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
