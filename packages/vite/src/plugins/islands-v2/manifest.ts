import { genDynamicImport, genImport, genObjectFromRawEntries, genString } from 'knitwork'
import type { Plugin } from 'vite'

/**
 * Client chunk a `v-load-client` tag loads, baked into the SSR render call as literals.
 */
export interface IslandsV2ClientTarget {
  /**
   * Chunk ref, as `toChunkRef` produces it for both the server marker and the client table.
   */
  chunk: string
  exportName: string
}

/**
 * Scanned `v-load-client` targets, shared by the scan, the template transform and the manifest plugin.
 */
export interface IslandsV2Registry {
  /**
   * Chunk ref of every registered target, by absolute file path.
   */
  targets: Map<string, string>
  /**
   * Targets of each scanned SFC, by absolute file path then by template tag as written.
   */
  components: Map<string, Map<string, IslandsV2ClientTarget>>
  /**
   * Invalidates the dev manifest module when a new target is registered.
   */
  invalidate?: () => void
}

const MANIFEST_ID = '#islands-v2-manifest'
const MANIFEST_RESOLVED_ID = '\0nuxt:islands-v2-manifest'
const IMPORT_FN_ID = '#app/components/islands-v2/import-fn'

/**
 * Provides `#islands-v2-manifest`, exporting the `importFn` the client island loader resolves
 * `v-load-client` chunks with. Server environments never load chunks, so their `importFn` throws.
 */
export function islandsV2ManifestPlugin (registry: IslandsV2Registry): Plugin {
  return {
    name: 'nuxt:islands-v2-manifest',
    resolveId: {
      order: 'pre',
      handler (id) {
        if (id === MANIFEST_ID) { return MANIFEST_RESOLVED_ID }
      },
    },
    configureServer (server) {
      registry.invalidate = () => {
        for (const environment of Object.values(server.environments)) {
          const mod = environment.moduleGraph.getModuleById(MANIFEST_RESOLVED_ID)
          if (mod) { environment.moduleGraph.invalidateModule(mod) }
        }
      }
    },
    load (id) {
      if (id !== MANIFEST_RESOLVED_ID) { return }
      if (this.environment.config.consumer !== 'client') {
        return `export function importFn (src) { throw new Error(${genString('[nuxt] [islands] `v-load-client` chunks only load on the client, cannot load ')} + JSON.stringify(src)) }`
      }
      // `importFn` builds lazily: the root entry imports this module, so its exports may not be live yet.
      return [
        genImport(IMPORT_FN_ID, [{ name: 'createImportFn', as: '__createImportFn' }]),
        `const __table = ${genChunkTable(registry.targets)}`,
        'let __importFn',
        'export const importFn = (src, exportName) => (__importFn ??= __createImportFn(__table))(src, exportName)',
      ].join('\n')
    },
  }
}

function genChunkTable (targets: ReadonlyMap<string, string>): string {
  return genObjectFromRawEntries([...targets].map(([filePath, chunk]) => [chunk, genDynamicImport(filePath)]))
}
