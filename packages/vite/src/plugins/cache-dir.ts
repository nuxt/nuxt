import { resolve } from 'pathe'
import type { Plugin } from 'vite'

export function cacheDirPlugin (rootDir: string, name: string) {
  const optimizeCacheDir = resolve(rootDir, 'node_modules/.cache/vite', name)
  return <Plugin> {
    name: 'nuxt:cache-dir',
    configResolved (resolvedConfig) {
      // @ts-expect-error
      resolvedConfig.optimizeCacheDir = optimizeCacheDir
    }
  }
}
