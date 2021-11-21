import { readPackageJSON, resolvePackageJSON } from 'pkg-types'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { importModule, tryImportModule, RequireModuleOptions } from '../internal/cjs'
import type { LoadNuxtConfigOptions } from './config'

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
    envConfig: opts.dotenv // TODO: Backward format convertion
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
