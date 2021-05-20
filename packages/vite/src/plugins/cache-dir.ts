import { resolve } from 'upath'
import type { Plugin } from 'vite'

export function cacheDirPlugin (rootDir, name: string) {
  const optimizeCacheDir = resolve(rootDir, 'node_modules/.cache/vite', name)
  return <Plugin> {
    name: 'nuxt:cache-dir',
    configResolved (resolvedConfig) {
      // @ts-ignore
      resolvedConfig.optimizeCacheDir = optimizeCacheDir
    }
  }
}
