import process from 'node:process'
import { filterAliases, resolveAlias } from '@nuxt/kit'
import type { AliasValue, Nuxt } from '@nuxt/schema'
import { dirname, isAbsolute, relative, resolve } from 'pathe'
import { createUnplugin } from 'unplugin'
import escapeStringRegexp from 'escape-string-regexp'

const PREFIX = 'virtual:nuxt:'
const PREFIX_RE = /^\/?virtual:nuxt:/

// encode the vfs key as a path relative to `rootDir` so that the same Nuxt
// source produces byte-identical SSR output across machines
export function toVirtualId (absolutePath: string, nuxt: Nuxt): string {
  return PREFIX + encodeURIComponent(relative(nuxt.options.rootDir, absolutePath))
}

export function fromVirtualId (id: string, nuxt: Nuxt): string {
  const search = id.match(QUERY_RE)?.[0] || ''
  const relativePart = withoutQuery(decodeURIComponent(withoutPrefix(id)))
  return resolve(nuxt.options.rootDir, relativePart) + search
}

interface VirtualFSPluginOptions {
  mode: 'client' | 'server'
  alias?: Record<string, AliasValue>
}

const RELATIVE_ID_RE = /^\.{1,2}[\\/]/
export const VirtualFSPlugin = (nuxt: Nuxt, options: VirtualFSPluginOptions) => createUnplugin((_, meta) => {
  const extensions = ['', ...nuxt.options.extensions]
  const alias = {
    ...filterAliases(nuxt.options.alias, options.mode === 'server' ? 'server' : 'app'),
    ...options.alias ? filterAliases(options.alias, options.mode === 'server' ? 'server' : 'app') : {},
  }

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

  function resolveId (id: string, importer?: string) {
    id = resolveAlias(id, alias)

    if (PREFIX_RE.test(id)) {
      id = fromVirtualId(id, nuxt)
    }

    const search = id.match(QUERY_RE)?.[0] || ''
    id = withoutQuery(id)

    if (process.platform === 'win32' && isAbsolute(id)) {
      // Add back C: prefix on Windows
      id = resolve(id)
    }

    const resolvedId = resolveWithExt(id)
    if (resolvedId) {
      return toVirtualId(resolvedId, nuxt) + search
    }

    if (importer && RELATIVE_ID_RE.test(id)) {
      const path = resolve(dirname(withoutQuery(fromVirtualId(importer, nuxt))), id)
      // resolve relative paths to virtual files
      const resolved = resolveWithExt(path)
      if (resolved) {
        return toVirtualId(resolved, nuxt) + search
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
            return this.resolve?.(id, withoutQuery(fromVirtualId(importer, nuxt)), { skipSelf: true })
          }
        },
      },
    },

    load: {
      filter: {
        id: PREFIX_RE,
      },
      handler (id) {
        const key = withoutQuery(fromVirtualId(id, nuxt))
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
