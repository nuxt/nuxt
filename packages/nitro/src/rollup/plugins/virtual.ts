// Based on https://github.com/rollup/plugins/blob/master/packages/virtual/src/index.ts
import * as path from 'path'

import { Plugin } from 'rollup'

type UnresolvedModule = string | (() => string)
export interface RollupVirtualOptions {
  [id: string]: UnresolvedModule;
}

const PREFIX = '\0virtual:'

const resolveModule = (m: UnresolvedModule) => typeof m === 'function' ? m() : m

export default function virtual (modules: RollupVirtualOptions): Plugin {
  const resolvedIds = new Map<string, string |(() => string)>()

  Object.keys(modules).forEach((id) => {
    resolvedIds.set(path.resolve(id), modules[id])
  })

  return {
    name: 'virtual',

    resolveId (id, importer) {
      if (id in modules) { return PREFIX + id }

      if (importer) {
        const importerNoPrefix = importer.startsWith(PREFIX)
          ? importer.slice(PREFIX.length)
          : importer
        const resolved = path.resolve(path.dirname(importerNoPrefix), id)
        if (resolvedIds.has(resolved)) { return PREFIX + resolved }
      }

      return null
    },

    load (id) {
      if (!id.startsWith(PREFIX)) {
        return null
      }
      const idNoPrefix = id.slice(PREFIX.length)
      return idNoPrefix in modules
        ? resolveModule(modules[idNoPrefix])
        : resolveModule(resolvedIds.get(idNoPrefix))
    }
  }
}
