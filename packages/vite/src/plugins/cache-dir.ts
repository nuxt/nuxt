import type { Plugin } from 'vite'
import { resolve } from 'upath'

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
