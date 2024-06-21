import satisfies from 'semver/functions/satisfies.js' // npm/node-semver#381
import { readPackageJSON } from 'pkg-types'
import type { Nuxt, NuxtCompatibility, NuxtCompatibilityIssues } from '@nuxt/schema'
import { useNuxt } from './context'

export function normalizeSemanticVersion (version: string) {
  return version.replace(/-\d+\.[0-9a-f]+/, '') // Remove edge prefix
}

const builderMap = {
  '@nuxt/vite-builder': 'vite',
  '@nuxt/webpack-builder': 'webpack',
}

/**
 * Check version constraints and return incompatibility issues as an array
 */
export async function checkNuxtCompatibility (constraints: NuxtCompatibility, nuxt: Nuxt = useNuxt()): Promise<NuxtCompatibilityIssues> {
  const issues: NuxtCompatibilityIssues = []

  // Nuxt version check
  if (constraints.nuxt) {
    const nuxtVersion = getNuxtVersion(nuxt)
    if (!satisfies(normalizeSemanticVersion(nuxtVersion), constraints.nuxt, { includePrerelease: true })) {
      issues.push({
        name: 'nuxt',
        message: `Nuxt version \`${constraints.nuxt}\` is required but currently using \`${nuxtVersion}\``,
      })
    }
  }

  // Builder compatibility check
  if (constraints.builder && typeof nuxt.options.builder === 'string') {
    const currentBuilder = builderMap[nuxt.options.builder] || nuxt.options.builder
    if (currentBuilder in constraints.builder) {
      const constraint = constraints.builder[currentBuilder]!
      if (constraint === false) {
        issues.push({
          name: 'builder',
          message: `Not compatible with \`${nuxt.options.builder}\`.`,
        })
      } else {
        const builderVersion = await readPackageJSON(nuxt.options.builder, { url: nuxt.options.modulesDir }).then(r => r.version).catch(() => undefined)
        if (builderVersion && !satisfies(normalizeSemanticVersion(builderVersion), constraint, { includePrerelease: true })) {
          issues.push({
            name: 'builder',
            message: `Not compatible with \`${builderVersion}\` of \`${currentBuilder}\`. This module requires \`${constraint}\`.`,
          })
        }
      }
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
 * Check if current Nuxt instance is of specified major version
 */
export function isNuxtMajorVersion (majorVersion: 2 | 3 | 4, nuxt: Nuxt = useNuxt()) {
  const version = getNuxtVersion(nuxt)

  return version[0] === majorVersion.toString() && version[1] === '.'
}

/**
 * @deprecated Use `isNuxtMajorVersion(2, nuxt)` instead. This may be removed in \@nuxt/kit v5 or a future major version.
 */
export function isNuxt2 (nuxt: Nuxt = useNuxt()) {
  return isNuxtMajorVersion(2, nuxt)
}

/**
 * @deprecated Use `isNuxtMajorVersion(3, nuxt)` instead. This may be removed in \@nuxt/kit v5 or a future major version.
 */
export function isNuxt3 (nuxt: Nuxt = useNuxt()) {
  return isNuxtMajorVersion(3, nuxt)
}

/**
 * Get nuxt version
 */
export function getNuxtVersion (nuxt: Nuxt | any = useNuxt() /* TODO: LegacyNuxt */) {
  const rawVersion = nuxt?._version || nuxt?.version || nuxt?.constructor?.version
  if (!rawVersion) {
    throw new Error('Cannot determine nuxt version! Is current instance passed?')
  }
  return rawVersion.replace(/^v/g, '')
}
