import satisfies from 'semver/functions/satisfies.js' // npm/node-semver#381
import type { Nuxt, NuxtCompatibility, NuxtCompatibilityIssues } from '@nuxt/schema'
import { useNuxt } from './context'

/**
 * Check version constraints and return incompatibility issues as an array
 */
export async function checkNuxtCompatibility (constraints: NuxtCompatibility, nuxt: Nuxt = useNuxt()): Promise<NuxtCompatibilityIssues> {
  const issues: NuxtCompatibilityIssues = []

  // Nuxt version check
  if (constraints.nuxt) {
    const nuxtVersion = getNuxtVersion(nuxt)
    const nuxtSemanticVersion = nuxtVersion
      .replace(/-[0-9]+\.[0-9a-f]{7,8}/, '') // Remove edge prefix
    if (!satisfies(nuxtSemanticVersion, constraints.nuxt, { includePrerelease: true })) {
      issues.push({
        name: 'nuxt',
        message: `Nuxt version \`${constraints.nuxt}\` is required but currently using \`${nuxtVersion}\``
      })
    }
  }

  // Bridge compatibility check
  if (isNuxt2(nuxt)) {
    const bridgeRequirement = constraints.bridge
    const hasBridge = !!(nuxt.options as any).bridge
    if (bridgeRequirement === true && !hasBridge) {
      issues.push({
        name: 'bridge',
        message: 'Nuxt bridge is required'
      })
    } else if (bridgeRequirement === false && hasBridge) {
      issues.push({
        name: 'bridge',
        message: 'Nuxt bridge is not supported'
      })
    }
  }

  // Allow extending compatibility checks
  await nuxt.callHook('kit:compatibility', constraints, issues)

  // Issues formatter
  issues.toString = () =>
    issues.map(issue => ` - [${issue.name}] ${issue.message}`).join('\n')

  return issues
}

/**
 * Check version constraints and throw a detailed error if has any, otherwise returns true
 */
export async function assertNuxtCompatibility (constraints: NuxtCompatibility, nuxt: Nuxt = useNuxt()): Promise<true> {
  const issues = await checkNuxtCompatibility(constraints, nuxt)
  if (issues.length) {
    throw new Error('Nuxt compatibility issues found:\n' + issues.toString())
  }
  return true
}

/**
 * Check version constraints and return true if passed, otherwise returns false
 */
export async function hasNuxtCompatibility (constraints: NuxtCompatibility, nuxt: Nuxt = useNuxt()): Promise<boolean> {
  const issues = await checkNuxtCompatibility(constraints, nuxt)
  return !issues.length
}

/**
 * Check if current nuxt instance is version 2 legacy
 */
export function isNuxt2 (nuxt: Nuxt = useNuxt()) {
  return getNuxtVersion(nuxt).startsWith('2.')
}

/**
 * Check if current nuxt instance is version 3
 */
export function isNuxt3 (nuxt: Nuxt = useNuxt()) {
  return getNuxtVersion(nuxt).startsWith('3.')
}

/**
 * Get nuxt version
 */
export function getNuxtVersion (nuxt: Nuxt | any = useNuxt() /* TODO: LegacyNuxt */) {
  const version = (nuxt?._version || nuxt?.version || nuxt?.constructor?.version || '').replace(/^v/g, '')
  if (!version) {
    throw new Error('Cannot determine nuxt version! Is current instance passed?')
  }
  return version
}
