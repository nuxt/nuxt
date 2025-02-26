import { readPackageJSON, resolvePackageJSON } from 'pkg-types'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { resolve } from 'pathe'
import { directoryToURL, importModule, tryImportModule } from '../internal/esm'
import { runWithNuxtContext } from '../context'
import type { LoadNuxtConfigOptions } from './config'

export interface LoadNuxtOptions extends LoadNuxtConfigOptions {
  /** Load nuxt with development mode */
  dev?: boolean

  /** Use lazy initialization of nuxt if set to false */
  ready?: boolean
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  // Backward compatibility
  opts.cwd = resolve(opts.cwd || (opts as any).rootDir /* backwards compat */ || '.')
  opts.overrides ||= (opts as any).config as NuxtConfig /* backwards compat */ || {}

  // Apply dev as config override
  opts.overrides.dev = !!opts.dev

  const nearestNuxtPkg = await Promise.all(['nuxt-nightly', 'nuxt']
    .map(pkg => resolvePackageJSON(pkg, { parent: opts.cwd! }).catch(() => null)))
    .then(r => (r.filter(Boolean) as string[]).sort((a, b) => b.length - a.length)[0])
  if (!nearestNuxtPkg) {
    throw new Error(`Cannot find any nuxt version from ${opts.cwd}`)
  }
  const pkg = await readPackageJSON(nearestNuxtPkg)

  const { loadNuxt } = await importModule<typeof import('nuxt')>((pkg as any)._name || pkg.name, { url: directoryToURL(opts.cwd!) })
  const nuxt = await loadNuxt(opts)
  return nuxt
}

export async function buildNuxt (nuxt: Nuxt): Promise<any> {
  const rootURL = directoryToURL(nuxt.options.rootDir)

  const { build } = await tryImportModule<typeof import('nuxt')>('nuxt-nightly', { url: rootURL }) || await importModule<typeof import('nuxt')>('nuxt', { url: rootURL })
  return runWithNuxtContext(nuxt, () => build(nuxt))
}
