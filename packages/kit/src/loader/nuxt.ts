import { pathToFileURL } from 'node:url'
import { readPackageJSON, resolvePackageJSON } from 'pkg-types'
import type { Nuxt } from '@nuxt/schema'
import { importModule, tryImportModule } from '../internal/esm'
import type { LoadNuxtConfigOptions } from './config'

export interface LoadNuxtOptions extends LoadNuxtConfigOptions {
  /** Load nuxt with development mode */
  dev?: boolean

  /** Use lazy initialization of nuxt if set to false */
  ready?: boolean

  /** @deprecated Use cwd option */
  rootDir?: LoadNuxtConfigOptions['cwd']

  /** @deprecated use overrides option */
  config?: LoadNuxtConfigOptions['overrides']
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  // Backward compatibility
  opts.cwd = opts.cwd || opts.rootDir
  opts.overrides = opts.overrides || opts.config || {}

  // Apply dev as config override
  opts.overrides.dev = !!opts.dev

  const nearestNuxtPkg = await Promise.all(['nuxt3', 'nuxt', 'nuxt-edge']
    .map(pkg => resolvePackageJSON(pkg, { url: opts.cwd }).catch(() => null)))
    .then(r => (r.filter(Boolean) as string[]).sort((a, b) => b.length - a.length)[0])
  if (!nearestNuxtPkg) {
    throw new Error(`Cannot find any nuxt version from ${opts.cwd}`)
  }
  const pkg = await readPackageJSON(nearestNuxtPkg)
  const majorVersion = parseInt((pkg.version || '').split('.')[0])

  const rootDir = pathToFileURL(opts.cwd || process.cwd()).href

  // Nuxt 3
  if (majorVersion === 3) {
    const { loadNuxt } = await importModule((pkg as any)._name || pkg.name, rootDir)
    const nuxt = await loadNuxt(opts)
    return nuxt
  }

  // Nuxt 2
  const { loadNuxt } = await tryImportModule('nuxt-edge', rootDir) || await importModule('nuxt', rootDir)
  const nuxt = await loadNuxt({
    rootDir: opts.cwd,
    for: opts.dev ? 'dev' : 'build',
    configOverrides: opts.overrides,
    ready: opts.ready,
    envConfig: opts.dotenv // TODO: Backward format conversion
  })

  return nuxt as Nuxt
}

export async function buildNuxt (nuxt: Nuxt): Promise<any> {
  const rootDir = pathToFileURL(nuxt.options.rootDir).href

  // Nuxt 3
  if (nuxt.options._majorVersion === 3) {
    const { build } = await tryImportModule('nuxt3', rootDir) || await importModule('nuxt', rootDir)
    return build(nuxt)
  }

  // Nuxt 2
  const { build } = await tryImportModule('nuxt-edge', rootDir) || await importModule('nuxt', rootDir)
  return build(nuxt)
}
