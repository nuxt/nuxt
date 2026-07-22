import { defu } from 'defu'
import type { NuxtConfig } from 'nuxt/schema'

export const builder = (process.env.TEST_BUILDER as 'webpack' | 'rspack' | 'vite' | 'nitro-vite') || 'vite'

export const isWebpack = builder === 'webpack' || builder === 'rspack'
export const nitroViteEnvironment = builder === 'nitro-vite'

export const isDev = process.env.TEST_ENV === 'dev'
export const isBuilt = !isDev

export const isTestingAppManifest = process.env.TEST_MANIFEST !== 'manifest-off'

export const asyncContext = process.env.TEST_CONTEXT === 'async'
export const typescriptBundlerResolution = process.env.MODULE_RESOLUTION !== 'node'

/**
 * Suffix identifying the current matrix combination.
 */
export const projectSuffix = [
  process.env.TEST_BUILDER,
  process.env.TEST_ENV,
  process.env.TEST_CONTEXT,
  process.env.TEST_MANIFEST,
].filter(Boolean).join('-') || 'default'

const isMatrixRun = !!process.env.TEST_BUILDER
const isCanonicalCombo = builder === 'vite' && !asyncContext && isTestingAppManifest

/**
 * True in exactly one fixture-matrix project (vite/built/default/manifest-on), and always true
 * outside the matrix. Guard suites that do not depend on any matrix axis with
 * `describe.skipIf(!runsOnceInMatrix)` so they run a single time instead of once per project.
 */
export const runsOnceInMatrix = !isMatrixRun || (isCanonicalCombo && isBuilt)

/**
 * Like `runsOnceInMatrix` but keeps the dev/built axis: true in exactly one dev project and one
 * built project.
 */
export const runsOncePerEnvInMatrix = !isMatrixRun || isCanonicalCombo

/**
 * Like `runsOnceInMatrix` but keeps the builder axis: true in exactly one built project per
 * builder. Use for builder-sensitive suites that do not depend on other matrix axes.
 */
export const runsOncePerBuilderInMatrix = !isMatrixRun || (isBuilt && !asyncContext && isTestingAppManifest)

export const isNuxtPrepare = process.argv.slice(2).includes('prepare')

export function withMatrix (config: NuxtConfig) {
  return defu(config, {
    builder: builder === 'nitro-vite' ? 'vite' : builder,
    devtools: { enabled: false },
    future: {
      typescriptBundlerResolution,
    },
    experimental: {
      asyncContext,
      appManifest: isTestingAppManifest,
      nitroViteEnvironment,
    },
    compatibilityDate: 'latest',
  })
}
