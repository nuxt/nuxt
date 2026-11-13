export function importFn (src: string): never {
  throw new Error(`[test] no client chunk for ${src}`)
}

export const chunkPaths: Record<string, string> = {}
