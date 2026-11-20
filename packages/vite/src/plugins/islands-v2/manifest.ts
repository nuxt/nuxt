import { genDynamicImport, genImport, genObjectFromRawEntries, genString } from 'knitwork'
import { normalize } from 'pathe'
import { joinURL } from 'ufo'
import type { Plugin, Rollup } from 'vite'

/**
 * Client chunk a `v-load-client` tag loads. The template transform writes it into the SSR render call
 * as literals.
 */
export interface IslandsV2ClientTarget {
  /**
   * Chunk ref (see `toChunkRef`), the key the server marker and the client import table share.
   */
  chunk: string
  exportName: string
  /**
   * Mounts the component on the client instead of hydrating, as its `.server.vue` half rendered the HTML.
   */
  mount?: boolean
}

/**
 * Scanned `v-load-client` targets, the component files those tags load.
 * Shared by the scan, the template transform and the manifest plugin.
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
   * Serves the targets to hosts that load this app's islands remotely. The client build emits each
   * as its own chunk, and the server manifest exports their paths relative to the app base URL.
   */
  remote?: {
    dev: boolean
    /**
     * `app.buildAssetsDir`, under which the dev server serves client modules.
     */
    buildAssetsDir: string
  }
  /**
   * Files that never load on the client: the client build fails when a target imports one.
   */
  serverOnlyFiles?: () => ReadonlySet<string>
}

const MANIFEST_ID = '#islands-v2-manifest'
const MANIFEST_RESOLVED_ID = '\0nuxt:islands-v2-manifest'
const IMPORT_FN_ID = '#app/components/islands-v2/import-fn'

/**
 * Provides `#islands-v2-manifest`. On the client it exports `importFn`, which the island loader uses
 * to load `v-load-client` chunks. On the server `importFn` throws, and `chunkPaths` gives the client
 * path of each chunk for remote hosts.
 */
export function islandsV2ManifestPlugin (registry: IslandsV2Registry, options: IslandsV2ManifestOptions = {}): Plugin {
  const { remote, serverOnlyFiles } = options
  // Chunk ref to Rollup reference id, then to the output path once the client bundle is generated.
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
          // `strict` keeps the module's exports as written, so a remote host can import them by name.
          emitted.set(chunk, this.emitFile({ type: 'chunk', id: filePath, preserveSignature: 'strict' }))
        }
      },
    },
    generateBundle (_, bundle) {
      if (this.environment.config.consumer !== 'client') { return }
      // Catches what the scan cannot see, such as a barrel file re-exporting a server component.
      const reached = serverOnlyFiles && findServerOnlyImport(this, serverOnlyFiles())
      if (reached) {
        this.error(`[nuxt] [islands] v-load-client target \`${reached.target}\` imports the server-only component \`${reached.file}\`, which cannot load on the client.`)
      }
      if (!emitted.size) { return }
      const fileNames = new Set<string>()
      for (const [chunk, referenceId] of emitted) {
        const fileName = this.getFileName(referenceId)
        fileNames.add(fileName)
        builtPaths.set(chunk, `/${fileName}`)
      }
      // Emitted chunks are entries, which the page renderer would otherwise load on every page.
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
      // Build `importFn` on first call: the app entry imports this module,
      // so `createImportFn` may not be initialized yet when it loads.
      return [
        genImport(IMPORT_FN_ID, [{ name: 'createImportFn', as: '__createImportFn' }]),
        `const __table = ${genObjectFromRawEntries([...registry.targets].map(([filePath, chunk]) => [chunk, genDynamicImport(filePath)]))}`,
        'let __importFn',
        'export const importFn = (src, exportName) => (__importFn ??= __createImportFn(__table))(src, exportName)',
      ].join('\n')
    },
  }

  /**
   * Client path of each target for remote hosts: the built chunk,
   * or in dev the module the dev server serves.
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

/**
 * Find the first server-only file reachable from a `v-load-client` target,
 * starting from the manifest module's dynamic imports.
 */
function findServerOnlyImport (ctx: Rollup.PluginContext, serverOnlyFiles: ReadonlySet<string>): { target: string, file: string } | undefined {
  const seen = new Set<string>()
  for (const target of ctx.getModuleInfo(MANIFEST_RESOLVED_ID)?.dynamicallyImportedIds ?? []) {
    const queue = [target]
    for (const id of queue) {
      if (seen.has(id)) { continue }
      seen.add(id)
      const file = normalize(id.split('?')[0]!)
      if (serverOnlyFiles.has(file)) { return { target, file } }
      const info = ctx.getModuleInfo(id)
      if (info) { queue.push(...info.importedIds, ...info.dynamicallyImportedIds) }
    }
  }
}
