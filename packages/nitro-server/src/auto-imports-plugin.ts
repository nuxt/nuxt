import { createUnplugin } from 'unplugin'
import { normalize } from 'pathe'
import type { ServerAutoImports } from './auto-imports.ts'

const EXCLUDE_RE = [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/]
const INCLUDE_RE = /\.[cm]?[jt]sx?$/

interface ServerAutoImportsPluginOptions {
  autoImports: ServerAutoImports
  sourcemap?: boolean
}

/**
 * Injects the server auto-imports.
 *
 * Registered on both the Rollup config and the `nitro` Vite environment, as either may build the
 * server bundle depending on `experimental.nitroViteEnvironment`.
 */
export const ServerAutoImportsPlugin = createUnplugin(({ autoImports, sourcemap }: ServerAutoImportsPluginOptions) => {
  return {
    name: 'nuxt:server-auto-imports',
    enforce: 'post',

    transformInclude (id) {
      const path = normalize(id)
      return INCLUDE_RE.test(path.split('?')[0]!) && !EXCLUDE_RE.some(re => re.test(path))
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
