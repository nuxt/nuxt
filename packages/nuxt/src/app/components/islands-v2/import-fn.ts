import type { DefineComponent } from 'vue'

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
