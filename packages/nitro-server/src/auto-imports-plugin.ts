import { createUnplugin } from 'unplugin'
import { normalize } from 'pathe'
import type { ServerAutoImports } from './auto-imports.ts'

const EXCLUDE_RE = [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/]
const INCLUDE_RE = /\.[cm]?[jt]sx?$/

interface ServerAutoImportsPluginOptions {
  autoImports: ServerAutoImports
  sourcemap?: boolean
  /** Modules that have already been through the app's auto-imports, such as the `ssr` environment's output. */
  exclude?: RegExp[]
}

/**
 * Injects the server auto-imports.
 *
 * Registered on the Rollup config only. Nitro passes `rollupConfig.plugins` to every server build,
 * including the `nitro` Vite environment and the prerender build.
 */
export const ServerAutoImportsPlugin = createUnplugin(({ autoImports, sourcemap, exclude = [] }: ServerAutoImportsPluginOptions) => {
  return {
    name: 'nuxt:server-auto-imports',
    enforce: 'post',

    transformInclude (id) {
      const path = normalize(id)
      return INCLUDE_RE.test(path.split('?')[0]!) && !EXCLUDE_RE.some(re => re.test(path)) && !exclude.some(re => re.test(path))
    },

    async transform (code, id) {
      const result = await autoImports.injectImports(code, id)
      if (!result?.s.hasChanged()) { return undefined }
      return {
        code: result.s.toString(),
        map: sourcemap ? result.s.generateMap({ hires: true }) : undefined,
      }
    },
  }
})
