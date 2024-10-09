import { resolveAlias, useNuxt } from '@nuxt/kit'
import { dirname, isAbsolute, resolve } from 'pathe'
import { createUnplugin } from 'unplugin'

const PREFIX = '\0virtual:nuxt:'

interface VirtualFSPluginOptions {
  mode: 'client' | 'server'
}

export const VirtualFSPlugin = (nuxt = useNuxt(), options: VirtualFSPluginOptions) => createUnplugin(() => {
  const extensions = ['', ...nuxt.options.extensions]

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
    resolveId (id, importer) {
      id = resolveAlias(id, nuxt.options.alias)

      if (process.platform === 'win32' && isAbsolute(id)) {
        // Add back C: prefix on Windows
        id = resolve(id)
      }

      const resolvedId = resolveWithExt(id)
      if (resolvedId) {
        return PREFIX + resolvedId
      }

      if (importer && /^\.{1,2}[\\/]/.test(id)) {
        const path = resolve(dirname(withoutPrefix(importer)), id)
        const resolved = resolveWithExt(path)
        if (resolved) {
          return PREFIX + resolved
        }
      }
    },

    loadInclude (id) {
      return id.startsWith(PREFIX) && withoutPrefix(id) in nuxt.vfs
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
