import { pathToFileURL } from 'node:url'
import { isAbsolute, resolve } from 'pathe'
import { builtinDriverDependencies, builtinDrivers, createStorage } from 'unstorage'
import { resolveModulePath } from 'exsolve'
import { directoryToURL } from '@nuxt/kit'
import type { Driver, Storage } from 'unstorage'
import type { Nitro, NitroConfig } from 'nitro/types'

import { nitroBuildDiagnostics } from './diagnostics.ts'

type StorageMounts = NonNullable<NitroConfig['kv']>

const MOUNT_SEPARATOR_RE = /[/\\]/g
const MOUNT_EDGE_RE = /^:+|:+$/g
const LIB_OPTION_RE = /^lib$|Lib$/

const toMountKey = (key: string) => key.replace(MOUNT_SEPARATOR_RE, ':').replace(MOUNT_EDGE_RE, '')

/** The writable filesystem mounts of Nitro v2, for the build, the prerenderer and the dev server. */
export function getLegacyStorageMounts (rootDir: string, buildDir: string): StorageMounts {
  return {
    build: { driver: 'fs', base: buildDir },
    cache: { driver: 'fs', base: resolve(buildDir, 'cache') },
    data: { driver: 'fs', base: resolve(rootDir, '.data/kv') },
  }
}

/**
 * Add `mounts` to the storage of the dev server and the prerenderer, except where the project
 * declares a mount of the same name. The added `cache` mount keeps the memory cache driver.
 */
export function addLegacyRuntimeMounts (nitroConfig: NitroConfig, mounts: StorageMounts): void {
  for (const env of ['$development', '$prerender'] as const) {
    const envConfig = nitroConfig[env] ||= {}
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const declared = [nitroConfig, envConfig].flatMap(config => [config.kv, config.storage, config.devStorage])
      .flatMap(declaredMounts => Object.keys(declaredMounts || {}).map(toMountKey))
    const added = Object.fromEntries(Object.entries(mounts).filter(([key]) => !declared.includes(key)))
    envConfig.kv = { ...added, ...envConfig.kv }
    const hasCacheDriver = nitroConfig.cache?.driver || envConfig.cache?.driver
    if (added.cache && !hasCacheDriver && !declared.some(key => key.startsWith('cache:'))) {
      envConfig.cache = { ...envConfig.cache, driver: 'memory' }
    }
  }
}

/**
 * The build-time storage of Nitro v2: `defaults`, then the mounts the project declares in
 * `kv` (or `storage`) and `devStorage`. Disposed when Nitro closes.
 */
export async function createLegacyBuildStorage (nitro: Pick<Nitro, 'options' | 'hooks'>, defaults: StorageMounts): Promise<Storage> {
  const storage = createStorage()
  const toMounts = (layer: StorageMounts = {}) => Object.fromEntries(Object.entries(layer).map(([base, mount]) => [toMountKey(base), mount]))
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const mounts = { ...toMounts(defaults), ...toMounts(nitro.options.kv), ...toMounts(nitro.options.devStorage) }
  for (const [base, { driver, ...options }] of Object.entries(mounts)) {
    storage.mount(base, await loadDriver(nitro.options.rootDir, base, driver, options))
  }
  nitro.hooks.hook('close', () => storage.dispose())
  return storage
}

async function loadDriver (rootDir: string, base: string, name: string, options: Record<string, unknown>): Promise<Driver> {
  const builtin = builtinDrivers[name as keyof typeof builtinDrivers]
  const path = builtin ? undefined : isAbsolute(name) ? name : resolveModulePath(name, { from: directoryToURL(rootDir), try: true })
  for (const [option, dependency] of Object.entries(builtinDriverDependencies[name as keyof typeof builtinDriverDependencies] || {})) {
    const lib = LIB_OPTION_RE.test(option) && options[option] === undefined && resolveModulePath(dependency.import || dependency.name, { from: directoryToURL(rootDir), try: true })
    if (lib) {
      options[option] = () => import(pathToFileURL(lib).href)
    }
  }
  try {
    const { default: factory } = await import(path ? pathToFileURL(path).href : builtin || name) as { default: (options: Record<string, unknown>) => Driver }
    return factory(options)
  } catch (error) {
    const fail = () => {
      throw nitroBuildDiagnostics.NUXT_B9016({ base: toMountKey(base), driver: name, error: error instanceof Error ? error.message : String(error) }, { method: 'error' })
    }
    return { name, hasItem: fail, getItem: fail, setItem: fail, removeItem: fail, getKeys: fail, clear: fail }
  }
}
