import { isBuiltin } from 'node:module'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'
import { dirname, normalize, relative } from 'pathe'
import escapeStringRegexp from 'escape-string-regexp'
import { lookupNodeModuleSubpath, parseNodeModulePath } from '@nuxt/kit/internal'

const BARE_ID_RE = /^(?!\.{0,2}[/\\]|[A-Z]:[/\\]|[\0#~]|virtual:)/i
const NODE_MODULES_FILE_RE = /^(?:[A-Z]:)?[/\\][^?#]*[/\\]node_modules[/\\][^?#]+\.[cm]?js$/i

function pkgName (id: string) {
  const segments = id.split('/')
  return id[0] === '@' ? segments.slice(0, 2).join('/') : segments[0]!
}

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

      // a deduped package must resolve to a single copy for the whole app
      const deduped = new Set(environment.config.resolve.dedupe)

      const conditions = [...new Set([...environment.config.resolve.conditions, 'import', 'default'])]
        .map(c => c === 'development|production' ? 'production' : c)

      // nuxt's own files are always inlined
      const nuxtDistRE = nuxt.options.appDir
        ? new RegExp('^' + escapeStringRegexp(dirname(nuxt.options.appDir) + '/') + '(?!.*node_modules)')
        : undefined

      const specifiers = new Map<string, Promise<{ specifier: string, path: string } | undefined>>()
      async function findSpecifier (file: string) {
        const { dir, name } = parseNodeModulePath(file)
        if (!dir || !name || deduped.has(name)) { return }
        const resolveFile = (specifier: string) => {
          const path = resolveModulePath(specifier, { try: true, from: `${dir}${name}/`, conditions, extensions: nuxt.options.extensions })
          return path && normalize(path) === normalize(file) ? { specifier, path } : undefined
        }
        const entry = resolveFile(name)
        if (entry) { return entry }
        const subpath = await lookupNodeModuleSubpath(file)
        return subpath?.startsWith('./') && subpath.length > 2 ? resolveFile(`${name}/${subpath.slice(2)}`) : undefined
      }

      return {
        name: 'nuxt:resolve-externals:external',
        resolveId: {
          filter: {
            id: {
              include: [BARE_ID_RE, NODE_MODULES_FILE_RE],
              exclude: nuxtDistRE ? [nuxtDistRE] : [],
            },
          },
          async handler (id, importer) {
            // an absolute import of a package file resolves like the bare specifier for that file
            if (importer && !BARE_ID_RE.test(id)) {
              let found = specifiers.get(id)
              if (!found) {
                found = findSpecifier(id)
                specifiers.set(id, found)
              }
              const { specifier, path } = (await found) ?? {}
              if (!specifier || !path) { return }
              // resolve from the file so the metadata comes from this copy, not the importer's
              const res = await this.resolve?.(specifier, path, { skipSelf: true }).catch(() => undefined)
              if (!res || res.external !== true || res.id !== specifier) { return }
              return { ...res, id: path, external: 'absolute' }
            }
            if (!importer || isBuiltin(id) || deduped.has(pkgName(id)) || localImporterRE?.test(importer)) { return }
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
