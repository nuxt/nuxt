import process from 'node:process'
import { resolveAlias } from '@nuxt/kit'
import { isWithinDir } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import { dirname, isAbsolute, resolve } from 'pathe'
import { createUnplugin } from 'unplugin'
import escapeStringRegexp from 'escape-string-regexp'
import { withTrailingSlash } from 'ufo'
import { combineRE } from '../utils/plugins.ts'
import { toVirtualId } from '../utils/virtual.ts'

const PREFIX_RE = /^\/?virtual:nuxt:/

function fromVirtualId (id: string, nuxt: Nuxt): string {
  const search = id.match(QUERY_RE)?.[0] || ''
  const relativePart = withoutQuery(decodeURIComponent(withoutPrefix(id)))
  return resolve(nuxt.options.rootDir, relativePart) + search
}

interface VirtualFSPluginOptions {
  mode: 'client' | 'server'
  alias?: Record<string, string>
}

const RELATIVE_ID_RE = /^\.{1,2}[\\/]/
export const VirtualFSPlugin = (nuxt: Nuxt, options: VirtualFSPluginOptions) => createUnplugin((_, meta) => {
  const extensions = ['', ...nuxt.options.extensions]
  const alias = { ...nuxt.options.alias, ...options.alias }

  const resolveWithExt = (id: string) => {
    for (const suffix of ['.' + options.mode, '']) {
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

    if (!RELATIVE_ID_RE.test(id)) {
      const resolvedId = resolveWithExt(id)
      return resolvedId ? toVirtualId(resolvedId, nuxt) + search : undefined
    }

    if (importer) {
      const path = resolve(dirname(withoutQuery(fromVirtualId(importer, nuxt))), id)
      if (!PREFIX_RE.test(importer) && !vfsLocationRE.test(path)) {
        return
      }
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
    if (!key.startsWith('#build/') && !isWithinDir(key, nuxt.options.buildDir)) {
      vfsEntries.add(escapeDirectory(dirname(key)))
    }
  }

  const vfsLocations = [
    /^#build\//,
    new RegExp('^(\\w:)?' + escapeDirectory(withTrailingSlash(nuxt.options.buildDir))),
    ...Array.from(vfsEntries).map(id => new RegExp('^' + id)),
  ]
  const vfsLocationRE = combineRE(vfsLocations)

  const filter = {
    id: combineRE([
      PREFIX_RE,
      RELATIVE_ID_RE,
      ...vfsLocations,
      ...relevantAliases.size ? [new RegExp('^' + Array.from(relevantAliases).join('|') + '([\\\\/]|$)')] : [],
    ]),
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
