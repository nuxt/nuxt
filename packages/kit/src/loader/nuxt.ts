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

export async function loadNuxt (options: LoadNuxtOptions): Promise<Nuxt> {
  // Backward compatibility
  options.cwd = options.cwd || options.rootDir

  options.overrides = options.overrides || options.config || {}

  // Apply dev as config override
  options.overrides.dev = !!options.dev

  const nearestNuxtPackage = await Promise.all(['nuxt-nightly', 'nuxt3', 'nuxt', 'nuxt-edge']
    .map(
      (package__) => resolvePackageJSON(
        package__, { url: options.cwd }
      ).catch(() => {}))
  )
    .then(
      (r) => (
        r.filter(Boolean) as string[]
      ).sort((a, b) => b.length - a.length)[0]
    )

  if (!nearestNuxtPackage) {
    throw new Error(`Cannot find any nuxt version from ${options.cwd}`)
  }

  const package_ = await readPackageJSON(nearestNuxtPackage)
  const majorVersion = Number.parseInt((package_.version || '').split('.')[0])

  const rootDirectory = pathToFileURL(options.cwd || process.cwd()).href

  // Nuxt 3
  if (majorVersion === 3) {
    const { loadNuxt } = await importModule(
      (package_ as any)._name || package_.name, rootDirectory
    )

    const nuxt = await loadNuxt(options)

    return nuxt
  }

  // Nuxt 2
  const { loadNuxt } = await tryImportModule('nuxt-edge', rootDirectory) || await importModule('nuxt', rootDirectory)

  const nuxt = await loadNuxt({
    rootDir: options.cwd,
    for: options.dev ? 'dev' : 'build',
    configOverrides: options.overrides,
    ready: options.ready,
    envConfig: options.dotenv // TODO: Backward format conversion
  })

  // Mock new hookable methods
  nuxt.removeHook ||= nuxt.clearHook.bind(nuxt)

  nuxt.removeAllHooks ||= nuxt.clearHooks.bind(nuxt)

  nuxt.hookOnce ||= (
    name: string,
      function_: (...arguments_: any[]) => any, ...hookArguments: any[]
  ) => {
    const unsub = nuxt.hook(name, (...arguments_: any[]) => {
      unsub()

      return function_(...arguments_)
    }, ...hookArguments)

    return unsub
  }

  // https://github.com/nuxt/nuxt/tree/main/packages/kit/src/module/define.ts#L111-L113
  nuxt.hooks ||= nuxt

  return nuxt as Nuxt
}

export async function buildNuxt (nuxt: Nuxt): Promise<any> {
  const rootDirectory = pathToFileURL(nuxt.options.rootDir).href

  // Nuxt 3
  if (nuxt.options._majorVersion === 3) {
    const { build } = await tryImportModule('nuxt-nightly', rootDirectory)
      || await tryImportModule('nuxt3', rootDirectory)
      || await importModule('nuxt', rootDirectory)

    return build(nuxt)
  }

  // Nuxt 2
  const { build } = await tryImportModule('nuxt-edge', rootDirectory)
    || await importModule('nuxt', rootDirectory)

  return build(nuxt)
}
