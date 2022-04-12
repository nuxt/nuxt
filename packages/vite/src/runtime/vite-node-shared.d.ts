export interface ViteNodeRuntimeOptions {
  baseURL: string,
  rootDir: string,
  entryPath: string,
  base: string
}

export function getViteNodeOptions (): ViteNodeRuntimeOptions
