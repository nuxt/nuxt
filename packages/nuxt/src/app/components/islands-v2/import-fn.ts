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
 * Import function loading each chunk from `source`, at the path a remote island response gave for it.
 * The paths must be checked with `isChunkPath` first.
 */
export function createRemoteImportFn (source: string, paths: Record<string, string>): ImportFn {
  // `fromEntries` defines own properties, so a `__proto__` chunk ref cannot reach the prototype.
  return createImportFn(Object.fromEntries(Object.entries(paths).map(([chunk, path]) => [
    chunk,
    () => import(/* @vite-ignore */ joinURL(source, path)),
  ])))
}
