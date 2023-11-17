import satisfies from 'semver/functions/satisfies.js' // npm/node-semver#381
import { type Nuxt, type NuxtCompatibility, type NuxtCompatibilityIssues } from '@nuxt/schema'
import { useNuxt } from './context'

/**
 * Normalizes semantic version by removing nightly prefix.
 * @param version - Semantic version.
 * @returns Normalized semantic version
 */
export function normalizeSemanticVersion(version: string): string {
  return version.replace(/-\d+\.[\da-f]+/, '') // Remove nightly prefix
}

/**
 * Checks if constraints are met for the current Nuxt version. If not, returns an array of messages. Nuxt 2 version also checks for `bridge` support.
 * @param constraints - Constraints to check for.
 * @param nuxt - Nuxt instance. If not provided, it will be retrieved from the context via `useNuxt()` call.
 * @returns Compatibility issues
 * @see {@link https://nuxt.com/docs/api/kit/compatibility#checknuxtcompatibility documentation}
 */
export async function checkNuxtCompatibility(
  constraints: NuxtCompatibility,
  nuxt: Nuxt = useNuxt()
): Promise<NuxtCompatibilityIssues> {
  const issues: NuxtCompatibilityIssues = []

  // Nuxt version check
  if (constraints.nuxt) {
    const nuxtVersion = getNuxtVersion(nuxt)

    if (
      !satisfies(
        normalizeSemanticVersion(nuxtVersion),
        constraints.nuxt,
        { includePrerelease: true }
      )
    ) {
      issues.push({
        name: 'nuxt',
        message: `Nuxt version \`${
            constraints.nuxt
        }\` is required but currently using \`${nuxtVersion}\``
      })
    }
  }

  // Bridge compatibility check
  if (isNuxt2(nuxt)) {
    const isBridgeRequired = !!constraints.bridge

    const hasBridge = 'bridge' in nuxt.options && !!nuxt.options['bridge']

    if (isBridgeRequired && !hasBridge) {
      issues.push({
        name: 'bridge',
        message: 'Nuxt bridge is required'
      })
    } else if (isBridgeRequired && hasBridge) {
      issues.push({
        name: 'bridge',
        message: 'Nuxt bridge is not supported'
      })
    }
  }

  // Allow extending compatibility checks
  await nuxt.callHook('kit:compatibility', constraints, issues)

  // Issues formatter
  issues.toString = () => issues.map((issue) => ` - [${issue.name}] ${issue.message}`).join('\n')

  return issues
}

/**
 * Asserts that constraints are met for the current Nuxt version. If not, throws an error with the list of issues as string.
 * @param constraints - Constraints to check for.
 * @param nuxt - Nuxt instance. If not provided, it will be retrieved from the context via `useNuxt()` call.
 * @returns `true` if no issues are found
 * @see {@link https://nuxt.com/docs/api/kit/compatibility#assertnuxtcompatibility documentation}
 */
export async function assertNuxtCompatibility(
  constraints: NuxtCompatibility,
  nuxt: Nuxt = useNuxt()
): Promise<true> {
  const issues = await checkNuxtCompatibility(constraints, nuxt)

  if (issues.length > 0) {
    throw new Error('Nuxt compatibility issues found:\n' + issues.toString())
  }

  return true
}

/**
 * Checks if constraints are met for the current Nuxt version. Return `true` if all constraints are met, otherwise returns `false`. Nuxt 2 version also checks for `bridge` support.
 * @param constraints - Constraints to check for.
 * @param nuxt - Nuxt instance. If not provided, it will be retrieved from the context via `useNuxt()` call.
 * @returns `true` if no compatibility issues are found, `false` otherwise
 * @see {@link https://nuxt.com/docs/api/kit/compatibility#hasnuxtcompatibility documentation}
 */
export async function hasNuxtCompatibility(
  constraints: NuxtCompatibility,
  nuxt: Nuxt = useNuxt()
): Promise<boolean> {
  const issues = await checkNuxtCompatibility(constraints, nuxt)

  return issues.length === 0
}

/**
 * Checks if the current Nuxt version is 2.x.
 * @param nuxt - Nuxt instance. If not provided, it will be retrieved from the context via `useNuxt()` call.
 * @returns `true` if the current Nuxt version is 2.x, `false` otherwise
 * @see {@link https://nuxt.com/docs/api/kit/compatibility#isnuxt2 documentation}
 */
export function isNuxt2(nuxt: Nuxt = useNuxt()) {
  return getNuxtVersion(nuxt).startsWith('2.')
}

/**
 * Checks if the current Nuxt version is 3.x.
 * @param nuxt - Nuxt instance. If not provided, it will be retrieved from the context via `useNuxt()` call.
 * @returns `true` if the current Nuxt version is 3.x, `false` otherwise
 * @see {@link https://nuxt.com/docs/api/kit/compatibility#isnuxt3 documentation}
 */
export function isNuxt3(nuxt: Nuxt = useNuxt()) {
  return getNuxtVersion(nuxt).startsWith('3.')
}

/**
 * Returns the current Nuxt version.
 * @param nuxt - Nuxt instance. If not provided, it will be retrieved from the context via `useNuxt()` call.
 * @returns Current Nuxt version
 * @throws Will throw an error if Nuxt version cannot be determined.
 * @see {@link https://nuxt.com/docs/api/kit/compatibility#getnuxtversion documentation}
 */
export function getNuxtVersion(
  nuxt: Nuxt | object = useNuxt() /* TODO: LegacyNuxt */
) {
  let version = ''

  if ('_version' in nuxt) {
    version = nuxt._version
  } else if ('version' in nuxt && typeof nuxt.version === 'string') {
    version = nuxt.version
  } else if ('version' in nuxt.constructor && typeof nuxt.constructor.version === 'string') {
    version = nuxt.constructor.version
  }

  version = version.replaceAll(/^v/g, '')

  if (!version) {
    throw new Error('Cannot determine Nuxt version! Is current instance passed?')
  }

  return version
}
