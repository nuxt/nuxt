import './impl.ts'

import type { NuxtBuilder } from '@nuxt/schema'
import { bundlerDiagnostics } from '@nuxt/kit/internal'

import { bundle as bundleWithRsbuild } from './rsbuild.ts'

/**
 * @deprecated `@nuxt/rspack-builder` is deprecated in favour of `@nuxt/rsbuild-builder`.
 */
export const bundle: NuxtBuilder['bundle'] = (nuxt) => {
  bundlerDiagnostics.NUXT_B7029()
  return bundleWithRsbuild(nuxt)
}
