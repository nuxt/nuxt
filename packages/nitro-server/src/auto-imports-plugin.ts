import { createUnplugin } from 'unplugin'
import { join, normalize } from 'pathe'
import type { ServerAutoImports } from './auto-imports.ts'

const INCLUDE_RE = /\.[cm]?[jt]sx?$/

interface ServerAutoImportsPluginOptions {
  autoImports: ServerAutoImports
  /** Nitro build directory. Bundled outputs under `<buildDir>/vite/services/` and `<buildDir>/dist/server/` are not transformed. */
  buildDir: string
  /** Modules not to transform. Strings match any path containing them. */
  exclude: Array<string | RegExp>
  sourcemap?: boolean
}

/** Injects the server auto-imports. */
export const ServerAutoImportsPlugin = createUnplugin(({ autoImports, buildDir, exclude, sourcemap }: ServerAutoImportsPluginOptions) => {
  const bundledDirs = [join(buildDir, 'vite/services') + '/', join(buildDir, 'dist/server') + '/']

  return {
    name: 'nuxt:server-auto-imports',
    enforce: 'post',

    transformInclude (id) {
      const path = normalize(id)
      return INCLUDE_RE.test(path.split('?')[0]!) && !exclude.some(pattern => typeof pattern === 'string' ? path.includes(pattern) : pattern.test(path)) && !bundledDirs.some(dir => path.startsWith(dir))
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
