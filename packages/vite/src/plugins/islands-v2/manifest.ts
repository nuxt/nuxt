import { genDynamicImport, genImport, genObjectFromRawEntries, genString } from 'knitwork'
import { joinURL } from 'ufo'
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

export interface IslandsV2ManifestOptions {
  /**
   * Serves the targets to hosts loading this app's islands remotely: the client build emits each
   * as its own chunk and the server manifest exports their paths, relative to the app base URL.
   */
  remote?: {
    dev: boolean
    /**
     * `app.buildAssetsDir`, the base of the client modules in dev.
     */
    buildAssetsDir: string
  }
}

const MANIFEST_ID = '#islands-v2-manifest'
const MANIFEST_RESOLVED_ID = '\0nuxt:islands-v2-manifest'
const IMPORT_FN_ID = '#app/components/islands-v2/import-fn'

/**
 * Provides `#islands-v2-manifest`, exporting the `importFn` the client island loader resolves
 * `v-load-client` chunks with. Server environments never load chunks, so their `importFn` throws;
 * they export `chunkPaths` instead, the client path of each chunk for remote hosts.
 */
export function islandsV2ManifestPlugin (registry: IslandsV2Registry, options: IslandsV2ManifestOptions = {}): Plugin {
  const { remote } = options
  // Chunk ref to emitted chunk reference, then to its path once the client bundle is generated.
  const emitted = new Map<string, string>()
  const builtPaths = new Map<string, string>()

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
    buildStart: {
      // After the scan plugin's `buildStart`, which fills the registry.
      order: 'post',
      sequential: true,
      handler () {
        if (!remote || remote.dev || this.environment.config.consumer !== 'client') { return }
        for (const [filePath, chunk] of registry.targets) {
          // A strict signature keeps the component's own exports, so any host can import the chunk.
          emitted.set(chunk, this.emitFile({ type: 'chunk', id: filePath, preserveSignature: 'strict' }))
        }
      },
    },
    generateBundle (_, bundle) {
      if (!emitted.size || this.environment.config.consumer !== 'client') { return }
      const fileNames = new Set<string>()
      for (const [chunk, referenceId] of emitted) {
        const fileName = this.getFileName(referenceId)
        fileNames.add(fileName)
        builtPaths.set(chunk, `/${fileName}`)
      }
      // As emitted entries, the page renderer would otherwise load them on every page.
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && fileNames.has(output.fileName)) { output.isEntry = false }
      }
    },
    load (id) {
      if (id !== MANIFEST_RESOLVED_ID) { return }
      if (this.environment.config.consumer !== 'client') {
        return [
          `export function importFn (src) { throw new Error(${genString('[nuxt] [islands] `v-load-client` chunks only load on the client, cannot load ')} + JSON.stringify(src)) }`,
          `export const chunkPaths = ${genObjectFromRawEntries([...remoteChunkPaths()].map(([chunk, path]) => [chunk, genString(path)]))}`,
        ].join('\n')
      }
      // `importFn` builds lazily: the root entry imports this module, so its exports may not be live yet.
      return [
        genImport(IMPORT_FN_ID, [{ name: 'createImportFn', as: '__createImportFn' }]),
        `const __table = ${genObjectFromRawEntries([...registry.targets].map(([filePath, chunk]) => [chunk, genDynamicImport(filePath)]))}`,
        'let __importFn',
        'export const importFn = (src, exportName) => (__importFn ??= __createImportFn(__table))(src, exportName)',
      ].join('\n')
    },
  }

  /**
   * Client path of each target for remote hosts: the built chunk, or in dev the module the dev server serves.
   */
  function remoteChunkPaths (): Map<string, string> {
    if (!remote) { return new Map() }
    if (!remote.dev) { return builtPaths }
    const paths = new Map<string, string>()
    for (const [filePath, chunk] of registry.targets) {
      paths.set(chunk, chunk.startsWith('/') ? joinURL(remote.buildAssetsDir, chunk) : joinURL(remote.buildAssetsDir, '@fs', filePath))
    }
    return paths
  }
}
