import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'pathe'
import { resolveModulePath } from 'exsolve'
import type { Nuxt } from '@nuxt/schema'

/** Each Vue runtime package, and the package it is resolved from. */
const VUE_PACKAGE_PARENTS = {
  'vue': undefined,
  '@vue/runtime-dom': 'vue',
  '@vue/runtime-vapor': 'vue',
  '@vue/server-renderer': 'vue',
  '@vue/shared': 'vue',
  '@vue/runtime-core': '@vue/runtime-dom',
  '@vue/reactivity': '@vue/runtime-core',
} as const

export type VuePackageName = keyof typeof VUE_PACKAGE_PARENTS

export const VUE_PACKAGE_NAMES = Object.keys(VUE_PACKAGE_PARENTS) as VuePackageName[]

/** Matches an import of a Vue runtime package, or of one of its subpaths. */
export const VUE_PACKAGE_SPECIFIER_RE = /^(vue|@vue\/(?:runtime-dom|runtime-vapor|runtime-core|reactivity|shared|server-renderer))(?:\/|$)/

export interface VuePackages {
  /** The directory of each Vue runtime package that resolves. */
  dirs: Partial<Record<VuePackageName, string>>
  /** The version of `vue`, when it resolves. */
  version?: string
}

const vuePackagesCache = new WeakMap<Nuxt, VuePackages>()

/**
 * The single copy of Vue an app is built with: `vue` as resolved from Nuxt, and each `@vue/*`
 * runtime package as resolved from the package that depends on it.
 *
 * @internal
 */
export function resolveVuePackages (nuxt: Nuxt): VuePackages {
  let packages = vuePackagesCache.get(nuxt)
  if (!packages) {
    const dirs: VuePackages['dirs'] = {}
    for (const [name, parent] of Object.entries(VUE_PACKAGE_PARENTS) as [VuePackageName, VuePackageName | undefined][]) {
      const from = parent ? dirs[parent] : nuxt.options.appDir
      const dir = from && resolvePackageDir(name, from)
      if (dir) {
        dirs[name] = dir
      }
    }
    packages = { dirs, version: dirs.vue && readVersion(dirs.vue) }
    vuePackagesCache.set(nuxt, packages)
  }
  return packages
}

/**
 * A file inside the package `id` is resolved from, so that resolving `id` from it reaches the
 * resolved copy of Vue, or `undefined` if `id` is not a Vue runtime package that resolves.
 *
 * @internal
 */
export function resolveVuePackageImporter (packages: VuePackages, id: string): string | undefined {
  const name = id.match(VUE_PACKAGE_SPECIFIER_RE)?.[1] as VuePackageName | undefined
  const dir = name && packages.dirs[name]
  return dir ? join(dir, 'package.json') : undefined
}

/**
 * Whether `path` is inside one of the resolved Vue runtime packages.
 *
 * @internal
 */
export function isInVuePackages (packages: VuePackages, path: string): boolean {
  return Object.values(packages.dirs).some(dir => path.startsWith(dir + '/'))
}

function resolvePackageDir (name: string, from: string): string | undefined {
  const path = resolveModulePath(`${name}/package.json`, { from: from.endsWith('/') ? from : from + '/', try: true })
  return path ? dirname(realpathSync(path)) : undefined
}

function readVersion (dir: string): string | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version
  } catch {
    return undefined
  }
}
