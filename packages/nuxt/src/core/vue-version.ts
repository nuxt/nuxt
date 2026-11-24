import { readFileSync } from 'node:fs'
import { resolveModulePath } from 'exsolve'
import { withTrailingSlash } from 'ufo'
import { findMinimumForRange, isGreaterThanOrEqual, isValidRange, satisfies } from 'verkit'
import { bundlerDiagnostics, resolveVuePackages } from '@nuxt/kit/internal'
import type { Nuxt } from 'nuxt/schema'

export function checkVueVersion (nuxt: Nuxt): void {
  const { fromApp, version } = resolveVuePackages(nuxt)
  if (!fromApp || !version) {
    return
  }

  const declared = declaredVueRange(nuxt)
  const minimum = declared && isValidRange(declared) ? findMinimumForRange(declared) : undefined
  // `*` and `>=0.0.0` have a 0.0.0 minimum, so they cannot be compared against
  if (declared && minimum && (minimum.major || minimum.minor || minimum.patch)) {
    if (!satisfies(version, declared, { includePrerelease: true })) {
      bundlerDiagnostics.NUXT_B7042({ version, expected: declared })
    }
    return
  }

  // nuxt can declare `vue` with a specifier that is not a comparable range, such as a catalog entry
  const nuxtVersion = nuxtVueVersion(nuxt)
  if (nuxtVersion && !isGreaterThanOrEqual(version, nuxtVersion)) {
    bundlerDiagnostics.NUXT_B7042({ version, expected: nuxtVersion })
  }
}

function declaredVueRange (nuxt: Nuxt): string | undefined {
  const path = resolveModulePath('nuxt/package.json', { from: withTrailingSlash(nuxt.options.appDir), try: true })
  if (!path) {
    return
  }
  const { dependencies, peerDependencies }: { dependencies?: Record<string, string>, peerDependencies?: Record<string, string> } = JSON.parse(readFileSync(path, 'utf8'))
  return peerDependencies?.vue ?? dependencies?.vue
}

function nuxtVueVersion (nuxt: Nuxt): string | undefined {
  const path = resolveModulePath('vue/package.json', { from: withTrailingSlash(nuxt.options.appDir), try: true })
  const version: string | undefined = path && JSON.parse(readFileSync(path, 'utf8')).version
  return version
}
