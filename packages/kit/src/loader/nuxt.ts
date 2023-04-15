import { pathToFileURL } from 'node:url'
import { readPackageJSON, resolvePackageJSON } from 'pkg-types'
import type { Nuxt } from '@nuxt/schema'
import { resolve } from 'pathe'
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

export interface ImportNuxtPackageOptions {
  cwd?: string
  version?: 2 | 3
}

const nuxtPackages = {
  2: ['nuxt-edge', 'nuxt'],
  3: ['nuxt3', 'nuxt'],
  all: ['nuxt3', 'nuxt', 'nuxt-edge']
}

export async function importNuxtPackage<T = any> (opts: Omit<ImportNuxtPackageOptions, 'version'> & { version: 3 }): Promise<{ version: 3, exports: T }>
export async function importNuxtPackage<T = any> (opts: Omit<ImportNuxtPackageOptions, 'version'> & { version: 2 }): Promise<{ version: 2, exports: T }>
export async function importNuxtPackage<T = any> (opts: ImportNuxtPackageOptions): Promise<{ version: 2 | 3, exports: T }>
export async function importNuxtPackage<T = any> (opts: ImportNuxtPackageOptions = {}): Promise<{ version: 2 | 3, exports: T }> {
  opts.cwd = resolve('.', opts.cwd || process.cwd())

  const packages = nuxtPackages[opts.version || 'all'] || nuxtPackages.all

  const nearestNuxtPkg = await Promise.all(packages
    .map(pkg => resolvePackageJSON(pkg, { url: opts.cwd }).catch(() => null)))
    .then(r => (r.filter(Boolean) as string[]).sort((a, b) => b.length - a.length)[0])

  if (!nearestNuxtPkg) {
    throw new Error(`Cannot find any Nuxt version from ${opts.cwd}`)
  }

  const pkg = await readPackageJSON(nearestNuxtPkg)
  const majorVersion = parseInt((pkg.version || '').split('.')[0])

  if (opts.version && opts.version !== majorVersion) {
    throw new Error(`Nearest Nuxt version in ${opts.cwd} is ${majorVersion} which does not match the requested version: ${opts.version}.`)
  }

  opts.cwd = pathToFileURL(opts.cwd).href

  // Nuxt 3
  if (majorVersion === 3) {
    return {
      version: 3,
      exports: await importModule((pkg as any)._name || pkg.name, opts.cwd)
    }
  }

  // Nuxt 2
  return {
    version: 2,
    exports: await tryImportModule('nuxt-edge', opts.cwd) || await importModule('nuxt', opts.cwd)
  }
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  // Backward compatibility
  opts.cwd = opts.cwd || opts.rootDir
  opts.overrides = opts.overrides || opts.config || {}

  // Apply dev as config override
  opts.overrides.dev = !!opts.dev

  const { version, exports: pkg } = await importNuxtPackage({ cwd: opts.cwd })

  // Nuxt 3
  if (version === 3) {
    return await (pkg as typeof import('nuxt')).loadNuxt(opts) as Nuxt
  }

  // Nuxt 2
  return await pkg.loadNuxt({
    rootDir: opts.cwd,
    for: opts.dev ? 'dev' : 'build',
    configOverrides: opts.overrides,
    ready: opts.ready,
    envConfig: opts.dotenv // TODO: Backward format conversion
  }) as Nuxt
}

export async function buildNuxt (nuxt: Nuxt): Promise<any> {
  const rootDir = pathToFileURL(nuxt.options.rootDir).href

  const { exports } = await importNuxtPackage({ cwd: rootDir, version: nuxt.options._majorVersion as 3 })

  return exports.build(nuxt)
}
