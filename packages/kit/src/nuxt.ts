import { getContext } from 'unctx'
import { readPackageJSON, resolvePackageJSON } from 'pkg-types'
import { importModule, tryImportModule, RequireModuleOptions } from './utils/cjs'
import type { Nuxt } from './types/nuxt'
import type { NuxtConfig } from './types/config'
import type { LoadNuxtConfigOptions } from './config/load'

/** Direct access to the Nuxt context - see https://github.com/unjs/unctx. */
export const nuxtCtx = getContext<Nuxt>('nuxt')

/**
 * Get access to Nuxt (if run within the Nuxt context) - see https://github.com/unjs/unctx.
 *
 * @example
 * ```js
 * const nuxt = useNuxt()
 * ```
 */
export const useNuxt = nuxtCtx.use

export interface LoadNuxtOptions extends LoadNuxtConfigOptions {
  rootDir: string
  dev?: boolean
  config?: NuxtConfig
  configFile?: string
  ready?: boolean
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  const resolveOpts: RequireModuleOptions = { paths: opts.rootDir }

  const nearestNuxtPkg = await Promise.all(['nuxt3', 'nuxt-edge', 'nuxt']
    .map(pkg => resolvePackageJSON(pkg, { url: opts.rootDir }).catch(() => null)))
    .then(r => r.filter(Boolean).sort((a, b) => b.length - a.length)[0])
  if (!nearestNuxtPkg) {
    throw new Error(`Cannot find any nuxt version from ${opts.rootDir}`)
  }
  const pkg = await readPackageJSON(nearestNuxtPkg)
  const majorVersion = parseInt((pkg.version || '').split('.')[0])

  // Nuxt 3
  if (majorVersion === 3) {
    const { loadNuxt } = await importModule('nuxt3', resolveOpts)
    const nuxt = await loadNuxt(opts)
    return nuxt
  }

  // Nuxt 2
  const { loadNuxt } = await tryImportModule('nuxt-edge', resolveOpts) || await importModule('nuxt', resolveOpts)
  const nuxt = await loadNuxt({
    rootDir: opts.rootDir,
    for: opts.dev ? 'dev' : 'build',
    configOverrides: opts.config,
    ready: opts.ready,
    envConfig: opts.envConfig
  })

  return nuxt as Nuxt
}

export async function buildNuxt (nuxt: Nuxt): Promise<any> {
  const resolveOpts: RequireModuleOptions = { paths: nuxt.options.rootDir }

  // Nuxt 3
  if (nuxt.options._majorVersion === 3) {
    const { build } = await importModule('nuxt3', resolveOpts)
    return build(nuxt)
  }

  // Nuxt 2
  const { build } = await tryImportModule('nuxt-edge', resolveOpts) || await tryImportModule('nuxt', resolveOpts)
  return build(nuxt)
}
