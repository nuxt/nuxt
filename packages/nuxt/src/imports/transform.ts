import { createUnplugin } from 'unplugin'
import type { Unimport } from 'unimport'
import { isAbsolute, normalize } from 'pathe'
import { tryUseNuxt } from '@nuxt/kit'

import { isJS, isVue } from '../core/utils/index.ts'
import { installNuxtModule } from '../core/features.ts'
import type { ImportsOptions } from 'nuxt/schema'

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const IMPORTS_RE = /(['"])#imports\1/
const WORKER_QUERY_RE = /[?&](worker|worker_file)(?:=|&|$)/

interface TransformPluginOptions {
  ctx: Pick<Unimport, 'injectImports'>
  options: Partial<ImportsOptions>
  sourcemap?: boolean
  rootDir?: string
  workspaceDir?: string
}

function isPathInside (targetPath: string, basePath: string) {
  const normalizedTarget = normalize(targetPath)
  const normalizedBase = normalize(basePath).replace(/\/+$/, '')
  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(normalizedBase + '/')
}

export const TransformPlugin = ({ ctx, options, sourcemap, rootDir, workspaceDir }: TransformPluginOptions) => createUnplugin(() => {
  return {
    name: 'nuxt:imports-transform',
    enforce: 'post',
    transformInclude (id) {
      // Included
      if (options.transform?.include?.some(pattern => pattern.test(id))) {
        return true
      }
      // Excluded
      if (options.transform?.exclude?.some(pattern => pattern.test(id))) {
        return false
      }

      // Vue files
      if (isVue(id, { type: ['script', 'template'] })) {
        return true
      }

      // Worker entry/module IDs can omit file extensions (e.g. `./foo?worker`)
      // but still need auto-import transforms in production builds.
      if (WORKER_QUERY_RE.test(id)) {
        return true
      }

      // JavaScript files
      return isJS(id)
    },
    async transform (code, id) {
      id = normalize(id)
      const isLinkedDependency = isAbsolute(id) && !!workspaceDir && !!rootDir
        ? !isPathInside(id, workspaceDir) && !isPathInside(id, rootDir)
        : false
      const isNodeModule = (NODE_MODULES_RE.test(id) || isLinkedDependency) && !options.transform?.include?.some(pattern => pattern.test(id))
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
  }
})
