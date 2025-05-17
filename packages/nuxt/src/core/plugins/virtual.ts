import { resolveAlias } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { dirname, isAbsolute, resolve } from 'pathe'
import { createUnplugin } from 'unplugin'

const PREFIX = 'virtual:nuxt:'
const PREFIX_RE = /^\/?virtual:nuxt:/

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

    if (importer && RELATIVE_ID_RE.test(id)) {
      const path = resolve(dirname(withoutPrefix(decodeURIComponent(importer))), id)
      // resolve relative paths to virtual files
      const resolved = resolveWithExt(path)
      if (resolved) {
        return PREFIX + encodeURIComponent(resolved) + search
      }
    }
  }

  return {
    name: 'nuxt:virtual',

    resolveId: meta.framework === 'vite' ? undefined : { order: 'pre', handler: resolveId },

    vite: {
      resolveId: {
        order: 'pre',
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

    loadInclude (id) {
      return PREFIX_RE.test(id) && withoutQuery(withoutPrefix(decodeURIComponent(id))) in nuxt.vfs
    },

    load (id) {
      const key = withoutQuery(withoutPrefix(decodeURIComponent(id)))
      return {
        code: nuxt.vfs[key] || '',
        map: null,
      }
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
