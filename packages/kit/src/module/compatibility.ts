import satisfies from 'semver/functions/satisfies.js' // npm/node-semver#381
import type { Nuxt, NuxtModule, NuxtOptions } from '@nuxt/schema'
import { useNuxt } from '../context'
import { normalizeSemanticVersion } from '../compatibility'
import { loadNuxtModuleInstance } from './install'

function resolveNuxtModuleEntryName (m: NuxtOptions['modules'][number]): string | false {
  if (typeof m === 'object' && !Array.isArray(m)) {
    return (m as any as NuxtModule).name
  }
  if (Array.isArray(m)) {
    return resolveNuxtModuleEntryName(m[0])
  }
  return m as string || false
}

/**
 * Check if a Nuxt module is installed by name.
 *
 * This will check both the installed modules and the modules to be installed. Note
 * that it cannot detect if a module is _going to be_ installed programmatically by another module.
 */
export function hasNuxtModule (moduleName: string, nuxt: Nuxt = useNuxt()) : boolean {
  // check installed modules
  return nuxt.options._installedModules.some(({ meta }) => meta.name === moduleName) ||
    // check modules to be installed
    nuxt.options.modules.some(m => moduleName === resolveNuxtModuleEntryName(m))
}

/**
 * Checks if a Nuxt Module is compatible with a given semver version.
 */
export async function hasNuxtModuleCompatibility (module: string | NuxtModule, semverVersion: string, nuxt: Nuxt = useNuxt()): Promise<boolean> {
  const version = await getNuxtModuleVersion(module, nuxt)
  if (!version) {
    return false
  }
  return satisfies(normalizeSemanticVersion(version), semverVersion, {
    includePrerelease: true
  })
}

/**
 * Get the version of a Nuxt module.
 *
 * Scans installed modules for the version, if it's not found it will attempt to load the module instance and get the version from there.
 */
export async function getNuxtModuleVersion (module: string | NuxtModule, nuxt: Nuxt | any = useNuxt()): Promise<string | false> {
  const moduleMeta = (typeof module === 'string' ? { name: module } : await module.getMeta?.()) || {}
  if (moduleMeta.version) { return moduleMeta.version }
  // need a name from here
  if (!moduleMeta.name) { return false }
  // maybe the version got attached within the installed module instance?
  const version = nuxt.options._installedModules
    // @ts-expect-error _installedModules is not typed
    .filter(m => m.meta.name === moduleMeta.name).map(m => m.meta.version)?.[0]
  if (version) {
    return version
  }
  // it's possible that the module will be installed, it just hasn't been done yet, preemptively load the instance
  if (hasNuxtModule(moduleMeta.name)) {
    const { buildTimeModuleMeta } = await loadNuxtModuleInstance(moduleMeta.name, nuxt)
    return buildTimeModuleMeta.version || false
  }
  return false
}
