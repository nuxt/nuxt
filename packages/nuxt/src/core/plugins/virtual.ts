import { resolveAlias, useNuxt } from '@nuxt/kit'
import { dirname, isAbsolute, join, resolve } from 'pathe'
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
    enforce: 'post',

    resolveId (id, importer) {
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

      if (importer && !isAbsolute(id)) {
        if (importer.startsWith(PREFIX)) {
          importer = importer.slice(PREFIX.length)
        }
        const resolved = resolveWithExt(join(dirname(importer), id))
        if (resolved) {
          return PREFIX + resolved
        }
      }
    },

    loadInclude (id) {
      return id.startsWith(PREFIX)
    },

    load (id) {
      return {
        code: nuxt.vfs[id.slice(PREFIX.length)] || '',
        map: null,
      }
    },
  }
})
