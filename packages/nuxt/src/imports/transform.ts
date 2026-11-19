import { createUnplugin } from 'unplugin'
import type { Import, Unimport } from 'unimport'
import type { EnvironmentModuleGraph, EnvironmentModuleNode } from 'vite'
import { normalize } from 'pathe'
import { tryUseNuxt } from '@nuxt/kit'

import { isJS, isVue, vitestCacheKey } from '../core/utils/index.ts'
import { installNuxtModule } from '../core/features.ts'
import type { ImportsOptions } from 'nuxt/schema'

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const IMPORTS_RE = /(['"])#imports\1/

interface TransformPluginOptions {
  ctx: Pick<Unimport, 'injectImports'>
  options: Partial<ImportsOptions>
  sourcemap?: boolean
  /**
   * Rescan a changed file for the imports it provides, returning a promise only when the file is
   * one we scan for imports.
   */
  refreshImports?: (file: string) => void | Promise<void>
  /**
   * Returns a counter that increases whenever the imports available for injection change, as
   * computed with `getImportsSignature`.
   */
  getImportsVersion?: () => number
  getImportsHash?: () => string
}

/** Serialises the fields of `imports` that affect the code injected into consumers. */
export function getImportsSignature (imports: Import[]) {
  return imports
    .map(i => JSON.stringify([i.from, i.name, i.as, i.type, i.typeFrom, i.priority, i.disabled, i.declarationType, i.with]))
    .join('\n')
}

function invalidateImporters (moduleGraph: EnvironmentModuleGraph, modules: Iterable<EnvironmentModuleNode> | undefined) {
  for (const mod of modules || []) {
    for (const importer of mod.importers) {
      moduleGraph.invalidateModule(importer)
    }
  }
}

function matches (patterns: RegExp[] | undefined, id: string) {
  return !!patterns?.some((pattern) => {
    // a global or sticky pattern otherwise resumes from the end of its previous match
    pattern.lastIndex = 0
    return pattern.test(id)
  })
}

function isTransformed (options: Partial<ImportsOptions>, id: string) {
  if (matches(options.transform?.include, id)) {
    return true
  }
  if (matches(options.transform?.exclude, id)) {
    return false
  }
  return isVue(id, { type: ['script', 'template'] }) || isJS(id)
}

export const TransformPlugin = ({ ctx, options, sourcemap, refreshImports, getImportsVersion, getImportsHash }: TransformPluginOptions) => createUnplugin(() => {
  const invalidatedAt = new WeakMap<object, Map<string, number>>()

  return {
    name: 'nuxt:imports-transform',
    enforce: 'post',
    transformInclude: id => isTransformed(options, id),
    async transform (code, id) {
      id = normalize(id)
      const isNodeModule = NODE_MODULES_RE.test(id) && !matches(options.transform?.include, id)
      // For modules in node_modules, we only transform `#imports` but not doing imports
      if (isNodeModule && !IMPORTS_RE.test(code)) {
        return
      }

      const { s, imports } = await ctx.injectImports(code, id, { autoImport: options.autoImport && !isNodeModule })
      if (imports.some(i => i.from === '#app/composables/script-stubs') && tryUseNuxt()?.options.test === false) {
        installNuxtModule('@nuxt/scripts')
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
    vite: {
      ...vitestCacheKey(({ id }) => isTransformed(options, id) ? getImportsHash?.() : undefined),
      hotUpdate: {
        order: 'pre',
        async handler ({ file, modules }) {
          // The exports a file provides can change with its contents, so it has to be rescanned
          // before its consumers are transformed again - otherwise they keep the imports it used
          // to provide, and the module they resolve to no longer has them.
          const path = normalize(file)
          const pending = refreshImports?.(path)
          if (!pending) { return }
          await pending

          // Vite soft-invalidates importers, which reuses their transform output, so they only
          // need a fresh transform once the available imports have changed.
          const version = getImportsVersion?.()
          if (version !== undefined) {
            let seen = invalidatedAt.get(this.environment)
            if (!seen) {
              seen = new Map()
              invalidatedAt.set(this.environment, seen)
            }
            if ((seen.get(path) ?? 0) === version) { return }
            seen.set(path, version)
          }

          // The injected imports live in the consumers' transform output, which is only
          // regenerated if their modules are invalidated as well.
          invalidateImporters(this.environment.moduleGraph, modules)
        },
      },
      configureServer (server) {
        // `hotUpdate` does not run on a server without HMR, so its graphs are invalidated from the watcher
        if (server.config.server.hmr !== false) { return }
        server.watcher.on('change', async (file) => {
          const pending = refreshImports?.(normalize(file))
          if (!pending) { return }
          await pending
          for (const environment of Object.values(server.environments)) {
            invalidateImporters(environment.moduleGraph, environment.moduleGraph.getModulesByFile(normalize(file)))
          }
        })
      },
    },
  }
})
