import satisfies from 'semver/functions/satisfies.js' // npm/node-semver#381
import type { Nuxt, NuxtCompatibilityConstraints, NuxtCompatibilityIssues } from '@nuxt/schema'
import { useNuxt } from './context'

/**
 * Check version constraints and return incompatibility issues as an array
 */
export function checkNuxtCompatibilityIssues (constraints: NuxtCompatibilityConstraints, nuxt: Nuxt = useNuxt()): NuxtCompatibilityIssues {
  const issues: NuxtCompatibilityIssues = []
  if (constraints.nuxt) {
    const nuxtVersion = getNuxtVersion(nuxt)
    const nuxtSemanticVersion = nuxtVersion.split('-').shift()
    if (!satisfies(nuxtSemanticVersion, constraints.nuxt)) {
      issues.push({
        name: 'nuxt',
        message: `Nuxt version \`${constraints.nuxt}\` is required but currently using \`${nuxtVersion}\``
      })
    }
  }
  issues.toString = () => issues.map(issue => ` - [${issue.name}] ${issue.message}`).join('\n')
  return issues
}

/**
 * Check version constraints and throw a detailed error if has any, otherwise returns true
 */
export function ensureNuxtCompatibility (constraints: NuxtCompatibilityConstraints, nuxt: Nuxt = useNuxt()): true {
  const issues = checkNuxtCompatibilityIssues(constraints, nuxt)
  if (issues.length) {
    throw new Error('Nuxt compatibility issues found:\n' + issues.toString())
  }
  return true
}

/**
 * Check version constraints and return true if passed, otherwise returns false
 */
export function hasNuxtCompatibility (constraints: NuxtCompatibilityConstraints, nuxt: Nuxt = useNuxt()) {
  return !checkNuxtCompatibilityIssues(constraints, nuxt).length
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
    throw new Error('Cannot determine nuxt version! Is currect instance passed?')
  }
  return version
}
