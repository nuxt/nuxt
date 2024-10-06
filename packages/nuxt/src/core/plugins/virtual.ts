import { findPath, resolveAlias, useNuxt } from '@nuxt/kit'
import { dirname, isAbsolute, resolve } from 'pathe'
import { createUnplugin } from 'unplugin'

const PREFIX = '\0virtual:nuxt:'

interface VirtualFSPluginOptions {
  mode: 'client' | 'server'
  alias?: Record<string, string>
}

export const VirtualFSPlugin = (nuxt = useNuxt(), options: VirtualFSPluginOptions) => createUnplugin(() => {
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
    enforce: 'pre',
    async resolveId (id, importer) {
      const _id = id
      id = resolveAlias(id, alias)

      if (process.platform === 'win32' && isAbsolute(id)) {
        // Add back C: prefix on Windows
        id = resolve(id)
      }

      const resolvedId = resolveWithExt(id)
      if (resolvedId) {
        return PREFIX + resolvedId
      }

      if (importer && /^\.{1,2}\//.test(id)) {
        const path = resolve(dirname(withoutPrefix(importer)), id)
        const resolved = resolveWithExt(path)
        if (resolved) {
          return PREFIX + resolved
        }
        if (importer.startsWith(PREFIX)) {
          const fsPath = await findPath(path, { fallbackToOriginal: false })
          if (fsPath) {
            return fsPath
          }
        }
      }
    },

    loadInclude (id) {
      return id.startsWith(PREFIX)
    },

    load (id) {
      return {
        code: nuxt.vfs[withoutPrefix(id)] || '',
        map: null,
      }
    },
  }
})

function withoutPrefix (id: string) {
  return id.startsWith(PREFIX) ? id.slice(PREFIX.length) : id
}
