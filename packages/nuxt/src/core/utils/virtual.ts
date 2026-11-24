import type { Nuxt } from '@nuxt/schema'
import { relative } from 'pathe'

const PREFIX = 'virtual:nuxt:'

// encode the vfs key as a path relative to `rootDir` so that the same Nuxt
// source produces byte-identical SSR output across machines
export function toVirtualId (absolutePath: string, nuxt: Nuxt): string {
  return PREFIX + encodeURIComponent(relative(nuxt.options.rootDir, absolutePath))
}
