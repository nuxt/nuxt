import type { Plugin, ResolvedConfig } from 'vite'
import { ensureDependencyInstalled, logger } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { Options } from '@vitejs/plugin-vue-jsx'

const JSX_RE = /\.[jt]sx$/
const VUE_JSX_VIRTUAL_RE = /^\/__vue-jsx/

/**
 * A lazy wrapper around `@vitejs/plugin-vue-jsx` that defers installation
 * and loading of the real plugin until a JSX/TSX file is actually encountered.
 *
 * This avoids pulling in the plugin's heavy dependency tree (Babel, etc.) for
 * projects that don't use JSX.
 */
export function VueJsxPlugin (nuxt: Nuxt, options?: Options): Plugin[] {
  let resolvedPlugin: Plugin | undefined
  let installPromise: Promise<Plugin | undefined> | undefined
  let installFailed = false
  let resolvedConfig: ResolvedConfig

  function loadPlugin (): Promise<Plugin | undefined> {
    if (resolvedPlugin) {
      return Promise.resolve(resolvedPlugin)
    }
    if (installFailed) {
      return Promise.resolve(undefined)
    }

    // Deduplicate concurrent calls while install is in progress
    installPromise ||= _loadPlugin()
    return installPromise
  }

  async function _loadPlugin (): Promise<Plugin | undefined> {
    const result = await ensureDependencyInstalled('@vitejs/plugin-vue-jsx', {
      rootDir: nuxt.options.rootDir,
      searchPaths: nuxt.options.modulesDir,
      from: import.meta.url,
    })

    if (!result) {
      installFailed = true
      logger.warn('Install `@vitejs/plugin-vue-jsx` to enable JSX support.')
      return undefined
    }

    const { default: viteJsxPlugin } = await import('@vitejs/plugin-vue-jsx')
    resolvedPlugin = viteJsxPlugin(options)

    // Replay configResolved so the real plugin captures HMR/sourcemap state
    if (resolvedConfig && typeof resolvedPlugin.configResolved === 'function') {
      resolvedPlugin.configResolved.call({} as any, resolvedConfig)
    }

    return resolvedPlugin
  }

  const transformPlugin: Plugin = {
    name: 'nuxt:vue-jsx',
    configResolved (config) {
      resolvedConfig = config
    },
    transform: {
      filter: {
        id: {
          include: [JSX_RE],
        },
      },
      async handler (code, id, transformOptions) {
        const plugin = await loadPlugin()
        if (!plugin) {
          return
        }

        const transform = typeof plugin.transform === 'function'
          ? plugin.transform
          : plugin.transform?.handler
        if (transform) {
          return transform.call(this, code, id, transformOptions)
        }
      },
    },
  }

  const virtualPlugin: Plugin = {
    name: 'nuxt:vue-jsx-virtual',
    resolveId: {
      filter: {
        id: {
          include: [VUE_JSX_VIRTUAL_RE],
        },
      },
      async handler (id, importer, options) {
        const plugin = await loadPlugin()
        if (!plugin) {
          return
        }
        const resolveId = typeof plugin.resolveId === 'function'
          ? plugin.resolveId
          : plugin.resolveId?.handler
        if (resolveId) {
          return resolveId.call(this, id, importer, options)
        }
      },
    },
    load: {
      filter: {
        id: {
          include: [VUE_JSX_VIRTUAL_RE],
        },
      },
      async handler (id) {
        const plugin = await loadPlugin()
        if (!plugin) {
          return
        }
        const load = typeof plugin.load === 'function'
          ? plugin.load
          : plugin.load?.handler
        if (load) {
          return load.call(this, id)
        }
      },
    },
  }

  return [transformPlugin, virtualPlugin]
}
