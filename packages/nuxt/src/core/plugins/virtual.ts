import { resolveAlias } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { dirname, isAbsolute, resolve } from 'pathe'
import { createUnplugin } from 'unplugin'

const PREFIX = 'virtual:nuxt:'

interface VirtualFSPluginOptions {
  mode: 'client' | 'server'
  alias?: Record<string, string>
}

const RELATIVE_ID_RE = /^\.{1,2}[\\/]/
export const VirtualFSPlugin = (nuxt: Nuxt, options: VirtualFSPluginOptions) => createUnplugin(() => {
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

  return {
    name: 'nuxt:virtual',

    resolveId: {
      order: 'pre',
      handler (id, importer) {
        id = resolveAlias(id, alias)

        if (process.platform === 'win32' && isAbsolute(id)) {
          // Add back C: prefix on Windows
          id = resolve(id)
        }

        const resolvedId = resolveWithExt(id)
        if (resolvedId) {
          return PREFIX + encodeURIComponent(resolvedId)
        }

        if (importer && RELATIVE_ID_RE.test(id)) {
          const path = resolve(dirname(withoutPrefix(decodeURIComponent(importer))), id)
          const resolved = resolveWithExt(path)
          if (resolved) {
            return PREFIX + encodeURIComponent(resolved)
          }
        }
      },
    },

    loadInclude (id) {
      return id.startsWith(PREFIX) && withoutPrefix(decodeURIComponent(id)) in nuxt.vfs
    },

    load (id) {
      return {
        code: nuxt.vfs[withoutPrefix(decodeURIComponent(id))] || '',
        map: null,
      }
    },
  }
})

function withoutPrefix (id: string) {
  return id.startsWith(PREFIX) ? id.slice(PREFIX.length) : id
}
