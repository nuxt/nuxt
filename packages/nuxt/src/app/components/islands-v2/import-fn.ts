import type { DefineComponent } from 'vue'
import { joinURL } from 'ufo'

export type ImportFn = (src: string, exportName?: string) => Promise<DefineComponent>

export type ChunkTable = Record<string, () => Promise<unknown>>

export function createImportFn (table: ChunkTable): ImportFn {
  return async (src, exportName = 'default') => {
    if (Object.hasOwn(table, src)) {
      const mod = await table[src]!() as Record<string, unknown>
      return (mod[exportName] ?? mod.default ?? mod) as DefineComponent
    }

    throw new Error(`[nuxt] [islands] No loader registered for chunk "${src}". Mark the component with \`v-load-client\` in a \`.vue\` template so it is scanned at build time.`)
  }
}

/**
 * Import function that loads each chunk from `source`, at the path the remote island response gave.
 * The paths must pass `isChunkPath` first, or a remote server could make the host import any script.
 */
export function createRemoteImportFn (source: string, paths: Record<string, string>): ImportFn {
  // `fromEntries` defines own properties, so a `__proto__` chunk ref cannot reach the prototype.
  return createImportFn(Object.fromEntries(Object.entries(paths).map(([chunk, path]) => [
    chunk,
    () => import(/* @vite-ignore */ joinURL(source, path)),
  ])))
}
