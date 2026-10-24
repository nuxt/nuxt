import { createUnplugin } from 'unplugin'
import { join, normalize } from 'pathe'
import type { ServerAutoImports } from './auto-imports.ts'

const EXCLUDE_RE = [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/]
const INCLUDE_RE = /\.[cm]?[jt]sx?$/

interface ServerAutoImportsPluginOptions {
  autoImports: ServerAutoImports
  /** Nitro build directory. Bundled environment outputs under `<buildDir>/vite/services/` are not transformed. */
  buildDir: string
  sourcemap?: boolean
}

/** Injects the server auto-imports. */
export const ServerAutoImportsPlugin = createUnplugin(({ autoImports, buildDir, sourcemap }: ServerAutoImportsPluginOptions) => {
  const servicesDir = join(buildDir, 'vite/services') + '/'

  return {
    name: 'nuxt:server-auto-imports',
    enforce: 'post',

    transformInclude (id) {
      const path = normalize(id)
      return INCLUDE_RE.test(path.split('?')[0]!) && !EXCLUDE_RE.some(re => re.test(path)) && !path.startsWith(servicesDir)
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
