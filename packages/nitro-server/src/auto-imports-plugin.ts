import { createUnplugin } from 'unplugin'
import { join, normalize } from 'pathe'
import { isWithinDir } from '@nuxt/kit/internal'
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

/**
 * Resolves a registered auto-import source that its importer cannot resolve from the directory
 * `autoImports.resolveSourceDir` names for it.
 */
export function serverImportSourcesPlugin (autoImports: Pick<ServerAutoImports, 'resolveSourceDir'>) {
  return {
    name: 'nuxt:server-import-sources',
    resolveId: {
      async handler (this: PluginContext, source: string, importer: string | undefined, options: Record<string, unknown>) {
        const dir = await autoImports.resolveSourceDir(source)
        if (!dir) {
          return
        }
        return await this.resolve(source, importer, { ...options, skipSelf: true })
          ?? this.resolve(source, join(dir, '_'), { ...options, skipSelf: true })
      },
    },
  }
}

/**
 * Serves the module `#imports/server` and `#imports` resolve to from `autoImports` rather than
 * from disk, so a build directory cleared after setup does not leave the specifiers unresolved.
 */
export function serverImportsModulePlugin (autoImports: Pick<ServerAutoImports, 'importsModulePath' | 'renderModule'>) {
  const moduleId = autoImports.importsModulePath + '.mjs'
  const ids = new Set(['#imports', '#imports/server', autoImports.importsModulePath, moduleId])
  return {
    name: 'nuxt:server-imports-module',
    resolveId: {
      order: 'pre' as const,
      handler (id: string) {
        if (ids.has(normalize(id))) {
          return moduleId
        }
      },
    },
    load (id: string) {
      if (id === moduleId) {
        return autoImports.renderModule()
      }
    },
  }
}

interface PluginContext {
  resolve: (id: string, importer?: string, options?: Record<string, unknown>) => Promise<{ id: string } | null>
}

/** Injects the server auto-imports. */
export const ServerAutoImportsPlugin = createUnplugin(({ autoImports, buildDir, exclude, sourcemap }: ServerAutoImportsPluginOptions) => {
  const bundledDirs = [join(buildDir, 'vite/services'), join(buildDir, 'dist/server')]

  return {
    name: 'nuxt:server-auto-imports',
    enforce: 'post',

    transformInclude (id) {
      const path = normalize(id)
      return INCLUDE_RE.test(path.split('?')[0]!) && !exclude.some(pattern => typeof pattern === 'string' ? path.includes(pattern) : pattern.test(path)) && !bundledDirs.some(dir => isWithinDir(path, dir))
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
