import type { Plugin } from 'vite'
import { replacePlugin } from 'rolldown/plugins'

// Vite serves `@vite-ignore` workers as `?worker_file&type=ignore` and injects an
// env preamble whose `defines` object uses string keys like `"import.meta.envName"`.
// Text replacement would rewrite those keys (e.g. `""development""`) and break parse.
// https://github.com/nuxt/nuxt/issues/36657
const IGNORE_WORKER_RE = /[?&]worker_file&type=ignore\b/

export function ReplacePlugin (): Plugin {
  return {
    name: 'nuxt:replace',
    enforce: 'post',
    applyToEnvironment (environment) {
      const config = environment.getTopLevelConfig()

      const replaceOptions: Record<string, string> = Object.create(null)

      for (const define of [config.define || {}, environment.config.define || {}]) {
        for (const key in define) {
          if (key.startsWith('import.meta.')) {
            replaceOptions[key] = define[key]
          }
        }
      }

      const plugin = replacePlugin(replaceOptions, { preventAssignment: true }) as Plugin
      const transformHook = plugin.transform
      if (!transformHook) {
        return plugin
      }

      const handler = typeof transformHook === 'function' ? transformHook : transformHook.handler
      const order = typeof transformHook === 'object' ? transformHook.order : undefined

      return {
        name: 'nuxt:replace',
        transform: {
          filter: {
            id: {
              exclude: IGNORE_WORKER_RE,
            },
          },
          order,
          handler,
        },
      }
    },
  }
}
