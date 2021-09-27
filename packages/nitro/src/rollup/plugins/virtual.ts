import * as path from 'pathe'
import type { Plugin } from 'rollup'

// Based on https://github.com/rollup/plugins/blob/master/packages/virtual/src/index.ts

type VirtualModule = string | { load: () => string | Promise<string> }

export interface RollupVirtualOptions {
  [id: string]: VirtualModule;
}

const PREFIX = '\0virtual:'

export default function virtual (modules: RollupVirtualOptions): Plugin {
  const _modules = new Map<string, VirtualModule>()

  for (const [id, mod] of Object.entries(modules)) {
    _modules.set(id, mod)
    _modules.set(path.resolve(id), mod)
  }

  return {
    name: 'virtual',

    resolveId (id, importer) {
      if (id in modules) { return PREFIX + id }

      if (importer) {
        const importerNoPrefix = importer.startsWith(PREFIX)
          ? importer.slice(PREFIX.length)
          : importer
        const resolved = path.resolve(path.dirname(importerNoPrefix), id)
        if (_modules.has(resolved)) { return PREFIX + resolved }
      }

      return null
    },

    async load (id) {
      if (!id.startsWith(PREFIX)) { return null }

      const idNoPrefix = id.slice(PREFIX.length)
      if (!_modules.has(idNoPrefix)) { return null }

      let m = _modules.get(idNoPrefix)
      if (typeof m !== 'string' && typeof m.load === 'function') {
        m = await m.load()
      }

      // console.log('[virtual]', idNoPrefix, '\n', m)

      return {
        code: m as string,
        map: null
      }
    }
  }
}
