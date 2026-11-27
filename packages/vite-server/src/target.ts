import { useServerBuild } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin, PluginOption } from 'vite'

/**
 * The Vite plugin names each deploy target is recognised by. Where a target also registers
 * plugins that do not build the deployable, only the one that does is matched.
 */
const DEPLOY_TARGETS: Array<[target: string, name: RegExp]> = [
  ['vercel', /^vite-plugin-vercel(?::|$)/],
  ['cloudflare', /^vite-plugin-cloudflare(?::|$)/],
  ['netlify', /^vite-plugin-netlify:build$/],
  ['node', /^ud:node:emit$/],
]

function detectDeployTarget (plugins: ReadonlyArray<{ name: string }>): string | undefined {
  for (const [target, name] of DEPLOY_TARGETS) {
    if (plugins.some(plugin => name.test(plugin.name))) {
      return target
    }
  }
}

/**
 * Tracks the deploy target of the server build, for `serverBuild.target`.
 *
 * Once Vite has resolved its config, the target is detected from the plugins resolved
 * with it: without a recognised plugin, it is `node`, or `undefined` in a build whose
 * server environment an unrecognised target has claimed.
 *
 * Until then, the target is `undefined` unless a plugin configured in `vite.plugins` builds
 * for a platform other than node, as a module can still add one with `addVitePlugin()`.
 */
export function DeployTargetPlugin (nuxt: Nuxt): { plugin: Plugin, target: () => string | undefined } {
  let resolved: { target: string | undefined } | undefined

  const emitsOwnEntry = () => nuxt.options.dev || useServerBuild(nuxt).runtime.handler !== undefined

  return {
    plugin: {
      name: 'nuxt:vite-server:deploy-target',
      configResolved (config) {
        resolved = { target: detectDeployTarget(config.plugins) }
      },
    },
    target: () => {
      if (resolved) {
        return resolved.target ?? (emitsOwnEntry() ? 'node' : undefined)
      }
      const target = detectDeployTarget(flattenPlugins(nuxt.options.vite.plugins, nuxt.options.dev ? 'serve' : 'build'))
      return target === 'node' ? undefined : target
    },
  }
}

function flattenPlugins (options: PluginOption[] | undefined, command: 'serve' | 'build', plugins: Array<{ name: string }> = []) {
  for (const option of options || []) {
    if (Array.isArray(option)) {
      flattenPlugins(option, command, plugins)
    } else if (option && !(option instanceof Promise) && (!('apply' in option) || option.apply === undefined || option.apply === command)) {
      plugins.push(option)
    }
  }
  return plugins
}
