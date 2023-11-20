import satisfies from 'semver/functions/satisfies.js' // npm/node-semver#381
import { type Nuxt, type NuxtModule, type NuxtOptions } from '@nuxt/schema'
import { useNuxt } from '../context'
import { normalizeSemanticVersion } from '../compatibility'
import { loadNuxtModuleInstance } from './install'

function resolveNuxtModuleEntryName (
  module: NuxtOptions['modules'][number]
): string | false {
  if (typeof module === 'object' && !Array.isArray(module)) {
    // eslint-disable-next-line ts/no-explicit-any
    return (module as any as NuxtModule).name
  }

  if (Array.isArray(module)) {
    return resolveNuxtModuleEntryName(module[0])
  }

  return module as string || false
}

/**
 * Check if a Nuxt module is installed by name.
 *
 * This will check both the installed modules and the modules to be installed. Note that it cannot detect if a module is _going to be_ installed.
 * programmatically by another module.
 * @param moduleName - Module name.
 * @param nuxt - Nuxt instance.
 * @returns `true` if the module is installed or to be installed, `false` otherwise
 */
export function hasNuxtModule (
  moduleName: string, nuxt: Nuxt = useNuxt()
): boolean {
  const hasInstalledModules = nuxt.options._installedModules.some(
    // eslint-disable-next-line ts/no-unsafe-member-access
    (module) => module.meta.name === moduleName
  )

  const hasModulesToBeInstalled = nuxt.options.modules.some(
    (module) => moduleName === resolveNuxtModuleEntryName(module)
  )

  return hasInstalledModules || hasModulesToBeInstalled
}

/**
 * Checks if a Nuxt Module is compatible with a given semver version.
 * @param module - Module name or Nuxt module.
 * @param semverVersion - Semver version.
 * @param nuxt - Nuxt instance.
 * @returns `true` if the module is compatible, `false` otherwise
 */
export async function hasNuxtModuleCompatibility (
  module: string | NuxtModule,
  semverVersion: string,
  nuxt: Nuxt = useNuxt()
): Promise<boolean> {
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
 * Scans installed modules for the version. If it's not found it will attempt to load the module instance and get the version from there.
 * @param module - Module name or Nuxt module.
 * @param nuxt - Nuxt instance.
 * @returns Module version if available, `false` otherwise
 */
export async function getNuxtModuleVersion (
  module: string | NuxtModule, nuxt: Nuxt | object = useNuxt()
): Promise<string | false> {
  const moduleMeta = (typeof module === 'string' ? { name: module } : await module.getMeta?.()) || {}

  if (moduleMeta.version) {
    return moduleMeta.version
  }

  // need a name from here
  if (!moduleMeta.name) {
    return false
  }

  // maybe the version got attached within the installed module instance?
  // @ts-expect-error _installedModules is not typed
  // eslint-disable-next-line style/max-len
  // eslint-disable-next-line ts/no-unsafe-assignment, ts/no-unsafe-member-access, ts/no-unsafe-call
  const version = nuxt.options._installedModules
    .filter(

      // @ts-expect-error _installedModules is not typed
      // eslint-disable-next-line ts/no-unsafe-member-access
      (module) => module.meta.name === moduleMeta.name

      // @ts-expect-error _installedModules is not typed
    // eslint-disable-next-line ts/no-unsafe-member-access, ts/no-unsafe-return
    ).map((module) => module.meta.version)?.[0]

  if (version) {
    // eslint-disable-next-line ts/no-unsafe-return
    return version
  }

  // it's possible that the module will be installed,
  // it just hasn't been done yet, preemptively load the instance
  if (hasNuxtModule(moduleMeta.name)) {
    const { buildTimeModuleMeta } = await loadNuxtModuleInstance(
      moduleMeta.name,

      // @ts-expect-error Nuxt might be an object
      nuxt
    )

    return buildTimeModuleMeta.version || false
  }

  return false
}
