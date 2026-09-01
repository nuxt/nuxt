import { readFileSync } from 'node:fs'
import { satisfies } from 'verkit'
import { readPackageJSON, resolvePackageJSON } from './internal/package-json.ts'
import type { Nuxt, NuxtCompatibility, NuxtCompatibilityIssues } from '@nuxt/schema'
import { directoryToURL } from './internal/esm.ts'
import { useNuxt } from './context.ts'
import type { NitroCompatibilityVersion } from './nitro-types.ts'
import { kitDiagnostics } from './diagnostics/kit-api.ts'

const SEMANTIC_VERSION_RE = /-\d+\.[0-9a-f]+/
export function normalizeSemanticVersion (version: string): string {
  return version.replace(SEMANTIC_VERSION_RE, '') // Remove edge prefix
}

const builderMap = {
  '@nuxt/rspack-builder': 'rspack',
  '@nuxt/vite-builder': 'vite',
  '@nuxt/webpack-builder': 'webpack',
}

function checkNuxtVersion (version: string, nuxt: Nuxt = useNuxt()): boolean {
  const nuxtVersion = getNuxtVersion(nuxt)
  return satisfies(normalizeSemanticVersion(nuxtVersion), version, { includePrerelease: true })
}

/**
 * Check version constraints and return incompatibility issues as an array
 */
export async function checkNuxtCompatibility (constraints: NuxtCompatibility, nuxt: Nuxt = useNuxt()): Promise<NuxtCompatibilityIssues> {
  const issues: NuxtCompatibilityIssues = []

  // Nuxt version check
  if (constraints.nuxt) {
    const nuxtVersion = getNuxtVersion(nuxt)
    if (!checkNuxtVersion(constraints.nuxt, nuxt)) {
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
        for (const parent of [nuxt.options.rootDir, nuxt.options.workspaceDir, import.meta.url]) {
          const builderVersion = await readPackageJSON(nuxt.options.builder, { parent }).then(r => r.version).catch(() => undefined)
          if (builderVersion) {
            if (!satisfies(normalizeSemanticVersion(builderVersion), constraint, { includePrerelease: true })) {
              issues.push({
                name: 'builder',
                message: `Not compatible with \`${builderVersion}\` of \`${currentBuilder}\`. This module requires \`${constraint}\`.`,
              })
            }
            break
          }
        }
      }
    }
  }

  // Nitro version check
  if (constraints.nitro) {
    const nitroVersion = getNitroFullVersion(nuxt)
    if (nitroVersion && !satisfies(normalizeSemanticVersion(nitroVersion), constraints.nitro, { includePrerelease: true })) {
      issues.push({
        name: 'nitro',
        message: `Nitro version \`${constraints.nitro}\` is required but currently using \`${nitroVersion}\``,
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
    throw kitDiagnostics.NUXT_B8004({ issues: issues.toString() })
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

export type NuxtMajorVersion = 2 | 3 | 4

/**
 * Check if current Nuxt instance is of specified major version
 */
export function isNuxtMajorVersion (majorVersion: NuxtMajorVersion, nuxt: Nuxt = useNuxt()): boolean {
  const version = getNuxtVersion(nuxt)

  return version[0] === majorVersion.toString() && version[1] === '.'
}

/**
 * @deprecated Use `isNuxtMajorVersion(2, nuxt)` instead. This may be removed in \@nuxt/kit v5 or a future major version.
 */
export function isNuxt2 (nuxt: Nuxt = useNuxt()): boolean {
  return isNuxtMajorVersion(2, nuxt)
}

/**
 * @deprecated Use `isNuxtMajorVersion(3, nuxt)` instead. This may be removed in \@nuxt/kit v5 or a future major version.
 */
export function isNuxt3 (nuxt: Nuxt = useNuxt()): boolean {
  return isNuxtMajorVersion(3, nuxt)
}

const nitroVersionCache = new WeakMap<Nuxt, string | undefined>()

function getNitroFullVersion (nuxt: Nuxt): string | undefined {
  const meta = (nuxt as any)._nitro?.meta
  if (typeof meta?.version === 'string') {
    return meta.version
  }
  if (nitroVersionCache.has(nuxt)) {
    return nitroVersionCache.get(nuxt)
  }
  let version: string | undefined
  try {
    const from = [
      ...(nuxt.options?.modulesDir || []).filter(Boolean).map(dir => directoryToURL(dir)),
      ...(nuxt.options?.rootDir ? [directoryToURL(nuxt.options.rootDir)] : []),
      import.meta.url,
    ]
    // a nuxt <5 host always builds with nitropack, so prefer it there.
    let nuxtMajor: number | undefined
    try {
      nuxtMajor = Number.parseInt(getNuxtVersion(nuxt), 10)
    } catch {
      // no nuxt version available; keep the default order
    }
    const packages = nuxtMajor !== undefined && nuxtMajor < 5 ? ['nitropack', 'nitro'] : ['nitro', 'nitropack']
    for (const pkg of packages) {
      const path = resolvePackageJSON(pkg, { from, try: true })
      if (path) {
        try {
          const parsed = JSON.parse(readFileSync(path, 'utf8')) as { name?: string, version?: string }
          if (parsed.name === pkg && parsed.version) {
            version = parsed.version
            break
          }
        } catch {
          // ignore unreadable package.json
        }
      }
    }
  } catch {
    // ignore resolution failures; the nitro version is simply unknown
  }
  nitroVersionCache.set(nuxt, version)
  return version
}

/**
 * Get the major version of nitro used by the current Nuxt instance.
 *
 * Resolution order:
 *
 * 1. `nuxt.options._nitroMajor`, stamped by the host before any module runs.
 * 2. `nuxt._nitro.meta.majorVersion` from the initialized nitro instance.
 * 3. Resolving the `nitro` / `nitropack` package from the project, which is correct on
 *    older hosts where the package is a direct dependency.
 *
 * Returns `undefined` when no nitro version can be determined; it never throws.
 */
export function getNitroVersion (nuxt: Nuxt = useNuxt()): number | undefined {
  const declaredMajor = nuxt?.options?._nitroMajor
  if (declaredMajor === 2 || declaredMajor === 3) {
    return declaredMajor
  }
  const majorVersion = (nuxt as any)?._nitro?.meta?.majorVersion
  if (typeof majorVersion === 'number') {
    return majorVersion
  }
  const version = getNitroFullVersion(nuxt)
  if (version) {
    const major = Number.parseInt(version, 10)
    if (!Number.isNaN(major)) {
      return major
    }
  }
}

/**
 * Check whether the nitro major version used by the current Nuxt instance is exactly `version`.
 *
 * Modules should use this to gate registration of handlers or plugins written for a specific
 * nitro major, for example `hasNitroVersion(3)` before `addServerHandler(handler, { version: 3 })`.
 *
 * Returns `false` when no nitro version can be determined.
 */
export function hasNitroVersion (version: NitroCompatibilityVersion, nuxt: Nuxt = useNuxt()): boolean {
  return getNitroVersion(nuxt) === version
}

const NUXT_VERSION_RE = /^v/g
/**
 * Get nuxt version
 */
export function getNuxtVersion (nuxt: Nuxt | any = useNuxt() /* TODO: LegacyNuxt */): string {
  const rawVersion = nuxt?._version || nuxt?.version || nuxt?.constructor?.version
  if (typeof rawVersion !== 'string') {
    throw kitDiagnostics.NUXT_B8005()
  }
  return rawVersion.replace(NUXT_VERSION_RE, '')
}
