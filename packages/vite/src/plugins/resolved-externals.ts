import { isBuiltin } from 'node:module'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { parseNodeModulePath } from '@nuxt/kit/internal'
import { resolveModulePath } from 'exsolve'
import { dirname, relative } from 'pathe'
import escapeStringRegexp from 'escape-string-regexp'

const BARE_ID_RE = /^(?!\.{0,2}[/\\]|[A-Z]:[/\\]|[\0#~]|virtual:)/i

export function ResolveExternalsPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:resolve-externals',
    enforce: 'pre',
    config () {
      return {
        optimizeDeps: {
          exclude: nuxt['~runtimeDependencies'],
        },
      }
    },
    applyToEnvironment (environment) {
      // a build that inlines everything has no externals to correct and is the deployable
      if (nuxt.options.dev || environment.name !== 'ssr' || environment.config.resolve.noExternal === true) {
        return false
      }

      // an importer inside the project (and outside node_modules) resolves a bare id to the
      // same package the build directory does, so there is nothing to correct for it
      const { rootDir, buildDir } = nuxt.options
      const localImporterRE = relative(rootDir, buildDir).startsWith('..')
        ? undefined
        : new RegExp('^' + escapeStringRegexp(rootDir.replace(/\/$/, '') + '/') + '(?!.*node_modules)')

      const conditions = [...new Set([...environment.config.resolve.conditions, 'import', 'default'])]
        .map(c => c === 'development|production' ? 'production' : c)

      return {
        name: 'nuxt:resolve-externals:external',
        resolveId: {
          filter: {
            id: BARE_ID_RE,
          },
          async handler (id, importer) {
            if (!importer || isBuiltin(id) || localImporterRE?.test(importer)) { return }
            const res = await this.resolve?.(id, importer, { skipSelf: true })
            if (!res || res.external !== true || res.id !== id) { return res }
            // every file in a package resolves a bare id the same way, so resolving from the
            // package directory lets exsolve's cache absorb the other import sites
            const { dir, name } = parseNodeModulePath(importer)
            const path = resolveModulePath(id, {
              try: true,
              from: dir && name ? `${dir}${name}/` : `${dirname(importer)}/`,
              conditions,
              extensions: nuxt.options.extensions,
            })
            if (!path) { return res }
            return { ...res, id: path, external: 'absolute' }
          },
        },
      }
    },
  }
}
