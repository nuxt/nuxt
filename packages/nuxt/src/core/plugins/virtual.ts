import process from 'node:process'
import { resolveAlias } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { dirname, isAbsolute, resolve } from 'pathe'
import { createUnplugin } from 'unplugin'
import escapeStringRegexp from 'escape-string-regexp'

const PREFIX = 'virtual:nuxt:'
const PREFIX_RE = /^\/?virtual:nuxt:/
const ROUTE_RULES_ID = '#build/route-rules.mjs'
const ROUTE_RULES_SUFFIX = '/route-rules.mjs'
const EMPTY_ROUTE_RULES_MATCHER = 'export default function () { return {} }'

interface VirtualFSPluginOptions {
  mode: 'client' | 'server'
  alias?: Record<string, string>
}

const RELATIVE_ID_RE = /^\.{1,2}[\\/]/
export const VirtualFSPlugin = (nuxt: Nuxt, options: VirtualFSPluginOptions) => createUnplugin((_, meta) => {
  const extensions = ['', ...nuxt.options.extensions]
  const alias = { ...nuxt.options.alias, ...options.alias }

  const resolveWithExt = (id: string) => {
    for (const suffix of ['', '.' + options.mode]) {
      for (const ext of extensions) {
        const rId = id + suffix + ext
        if (rId in nuxt.vfs) {
          return rId
        }
      }
    }
  }

  const isRouteRulesId = (id: string) => id === ROUTE_RULES_ID || id === nuxt.options.buildDir + ROUTE_RULES_SUFFIX

  function resolveId (id: string, importer?: string) {
    id = resolveAlias(id, alias)

    if (PREFIX_RE.test(id)) {
      id = withoutPrefix(decodeURIComponent(id))
    }

    const search = id.match(QUERY_RE)?.[0] || ''
    id = withoutQuery(id)

    if (process.platform === 'win32' && isAbsolute(id)) {
      // Add back C: prefix on Windows
      id = resolve(id)
    }

    const resolvedId = resolveWithExt(id)
    if (resolvedId) {
      return PREFIX + encodeURIComponent(resolvedId) + search
    }

    // `#build/route-rules.mjs` is provided by nitro templates and can be temporarily
    // unavailable in vfs during startup edge cases. Resolve it virtually so imports
    // don't fail before the template is registered.
    if (isRouteRulesId(id)) {
      return PREFIX + encodeURIComponent(id) + search
    }

    if (importer && RELATIVE_ID_RE.test(id)) {
      const path = resolve(dirname(withoutPrefix(decodeURIComponent(importer))), id)
      // resolve relative paths to virtual files
      const resolved = resolveWithExt(path)
      if (resolved) {
        return PREFIX + encodeURIComponent(resolved) + search
      }
    }
  }

  const relevantAliases = new Set<string>()
  for (const key in alias) {
    const value = alias[key]
    if (value && Object.keys(nuxt.vfs).some(vfsPath => vfsPath.startsWith(value))) {
      relevantAliases.add(escapeDirectory(key))
    }
  }

  const vfsEntries = new Set<string>()
  for (const key in nuxt.vfs) {
    if (!key.startsWith('#build/') && !key.startsWith(nuxt.options.buildDir)) {
      vfsEntries.add(escapeDirectory(dirname(key)))
    }
  }

  const filter = {
    id: [
      PREFIX_RE,
      RELATIVE_ID_RE,
      /^#build\//,
      new RegExp('^(\\w:)?' + escapeDirectory(nuxt.options.buildDir)),
      ...Array.from(vfsEntries).map(id => new RegExp('^' + id)),
      ...relevantAliases.size ? [new RegExp('^' + Array.from(relevantAliases).join('|') + '([\\\\/]|$)')] : [],
    ],
  }

  return {
    name: 'nuxt:virtual',

    resolveId: meta.framework === 'vite' ? undefined : { order: 'pre', filter, handler: resolveId },

    vite: {
      resolveId: {
        order: 'pre',
        filter,
        handler (id, importer) {
          const res = resolveId(id, importer)
          if (res) {
            return res
          }
          if (importer && PREFIX_RE.test(importer) && RELATIVE_ID_RE.test(id)) {
            return this.resolve?.(id, withoutPrefix(decodeURIComponent(importer)), { skipSelf: true })
          }
        },
      },
    },

    load: {
      filter: {
        id: PREFIX_RE,
      },
      handler (id) {
        const key = withoutQuery(withoutPrefix(decodeURIComponent(id)))

        if (isRouteRulesId(key) && !nuxt.vfs[key]) {
          return {
            code: EMPTY_ROUTE_RULES_MATCHER,
            map: null,
          }
        }

        return {
          code: nuxt.vfs[key] || '',
          map: null,
        }
      },
    },
  }
})

function withoutPrefix (id: string) {
  return id.replace(PREFIX_RE, '')
}

const QUERY_RE = /\?.*$/

function withoutQuery (id: string) {
  return id.replace(QUERY_RE, '')
}

function escapeDirectory (path: string) {
  return escapeStringRegexp(path).replace(/\//g, '[\\\\/]')
}
