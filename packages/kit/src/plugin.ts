import { normalize } from 'pathe'
import type { NuxtPlugin, NuxtPluginTemplate } from '@nuxt/schema'
import { useNuxt } from './context'
import { addTemplate } from './template'
import { resolveAlias } from './resolve'
import { logger } from './logger'

export function normalizePlugin (plugin: NuxtPlugin | string): NuxtPlugin {
  // Normalize src
  plugin = typeof plugin === 'string' ? { src: plugin } : { ...plugin }

  if (!plugin.src) {
    throw new Error('Invalid plugin. src option is required: ' + JSON.stringify(plugin))
  }

  // TODO: only scan top-level files #18418
  const nonTopLevelPlugin = plugin.src.match(/\/plugins\/[^/]+\/index\.[^/]+$/i)

  if (
    nonTopLevelPlugin
    && nonTopLevelPlugin.length > 0
    && !useNuxt().options.plugins.some(
      (index) => (typeof index === 'string' ? index : index.src).endsWith(nonTopLevelPlugin[0])
    )
  ) {
    logger.warn(`[deprecation] You are using a plugin that is within a subfolder of your plugins directory without adding it to your config explicitly. You can move it to the top-level plugins directory, or include the file '~${nonTopLevelPlugin[0]}' in your plugins config (https://nuxt.com/docs/api/nuxt-config#plugins-1) to remove this warning.`)
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

export interface AddPluginOptions {
  append?: boolean
}

/**
 * Registers a Nuxt plugin and adds it to the plugins array.
 *
 * **Note:** You can use mode or .client and .server modifiers with fileName option
 * to use plugin only on the client or server side.
 *
 * **Note:** By default plugin is prepended to the plugins array.
 * You can use second argument to append (push) instead.
 * @param plugin - A plugin object or a string with the path to the plugin. If a string is provided, it will be converted to a plugin object with `src` set to the string value. If a plugin object is provided, it must have the {@link https://nuxt.com/docs/api/kit/plugins#plugin following properties}.
 * @param options - Options to pass to the plugin. If `append` is set to true, the plugin will be appended to the plugins array instead of prepended.
 * @returns Nuxt plugin
 * @see {@link https://nuxt.com/docs/api/kit/plugins#addplugin documentation}
 * @example
 * ```js
 * addPlugin({
 *   src: path.resolve(__dirname, 'templates/foo.js'),
 *   filename: 'foo.server.js' // [optional] only include in server bundle
 * })
 * ```
 */
export function addPlugin (
  plugin: NuxtPlugin | string,
  options: AddPluginOptions = {}
) {
  const nuxt = useNuxt()

  // Normalize plugin
  const normalizedPlugin = normalizePlugin(plugin)

  // Remove any existing plugin with the same src
  nuxt.options.plugins = nuxt.options.plugins.filter(
    (p) => normalizePlugin(p).src !== normalizedPlugin.src
  )

  // Prepend to array by default to be before user provided plugins
  // since is usually used by modules
  nuxt.options.plugins[options.append ? 'push' : 'unshift'](normalizedPlugin)

  return normalizedPlugin
}

/**
 * Adds a template and registers it as a Nuxt plugin. This is useful for plugins that need to generate code at build time.
 * @param plugin - A plugin template object with the {@link https://nuxt.com/docs/api/kit/plugins#pluginoptions following properties}.
 * @param options - Options to pass to the plugin. If `append` is set to true, the plugin will be appended to the plugins array instead of prepended.
 * @returns Nuxt plugin
 * @see {@link https://nuxt.com/docs/api/kit/plugins#addplugintemplate documentation}
 */
export function addPluginTemplate (
  plugin: NuxtPluginTemplate | string,
  options: AddPluginOptions = {}
): NuxtPlugin {
  const normalizedPlugin: NuxtPlugin = typeof plugin === 'string'
    ? { src: plugin }

    // Update plugin src to template destination
    : { ...plugin, src: addTemplate(plugin).dst }

  return addPlugin(normalizedPlugin, options)
}
