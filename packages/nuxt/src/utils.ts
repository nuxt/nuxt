import { existsSync, promises as fsp } from 'node:fs'
import { useLogger, useNuxt } from '@nuxt/kit'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export async function isDirectory (path: string) {
  return (await fsp.lstat(path)).isDirectory()
}

export const logger = useLogger('nuxt')

export function getFirstNodeModulesDir () {
  const nuxt = useNuxt()
  for(const dir of nuxt.options.modulesDir) {
    if (existsSync(dir)) {
      return dir
    }
  }
}
