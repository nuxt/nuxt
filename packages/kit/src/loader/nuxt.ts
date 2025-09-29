import { pathToFileURL } from 'node:url'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { resolve } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { interopDefault } from 'mlly'
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

  const resolvedPath = ['nuxt-nightly', 'nuxt'].reduce((resolvedPath, pkg) => {
    const path = resolveModulePath(pkg, { try: true, from: [directoryToURL(opts.cwd!)] })
    return path && path.length > resolvedPath.length ? path : resolvedPath
  }, '')

  if (!resolvedPath) {
    throw new Error(`Cannot find any nuxt version from ${opts.cwd}`)
  }
  const { loadNuxt } = await import(pathToFileURL(resolvedPath).href).then(r => interopDefault(r)) as typeof import('nuxt')
  const nuxt = await loadNuxt(opts)
  return nuxt
}

export async function buildNuxt (nuxt: Nuxt): Promise<any> {
  const rootURL = directoryToURL(nuxt.options.rootDir)

  const { build } = await tryImportModule<typeof import('nuxt')>('nuxt-nightly', { url: rootURL }) || await importModule<typeof import('nuxt')>('nuxt', { url: rootURL })
  return runWithNuxtContext(nuxt, () => build(nuxt))
}
