import { defu } from 'defu'
import type { NuxtConfig } from 'nuxt/schema'

export const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack' || process.env.TEST_BUILDER === 'rsbuild'

export const isDev = process.env.TEST_ENV === 'dev'
export const isBuilt = !isDev

const _builder = process.env.TEST_BUILDER as 'webpack' | 'rsbuild' | 'rspack' | 'vite' | 'vite-env-api'
export const builder = _builder === 'vite-env-api' ? 'vite' : (_builder ?? 'vite')
export const viteEnvironmentApi = _builder === 'vite-env-api'

export const isTestingAppManifest = process.env.TEST_MANIFEST !== 'manifest-off'

export const asyncContext = process.env.TEST_CONTEXT === 'async'

/** Whether to opt in to the renderer rendering the error page itself. */
export const inlineErrorRendering = process.env.TEST_ERROR_RENDERING === 'inline-errors'

export const typescriptBundlerResolution = process.env.MODULE_RESOLUTION !== 'node'

export const isRenderingJson = process.env.TEST_PAYLOAD !== 'js'

/** Whether to resolve template components with the build transform rather than in the template compiler. */
export const legacyComponentResolution = process.env.TEST_COMPONENT_RESOLUTION === 'legacy'

/**
 * Suffix identifying the current matrix combination.
 */
export const projectSuffix = [
  process.env.TEST_BUILDER,
  process.env.TEST_ENV,
  process.env.TEST_CONTEXT,
  process.env.TEST_MANIFEST,
  process.env.TEST_PAYLOAD,
  process.env.TEST_ERROR_RENDERING,
  process.env.TEST_COMPONENT_RESOLUTION,
].filter(Boolean).join('-') || 'default'

const isMatrixRun = !!process.env.TEST_BUILDER
const isDefaultCombo = !asyncContext && isTestingAppManifest && isRenderingJson && !inlineErrorRendering && !legacyComponentResolution
const isCanonicalCombo = builder === 'vite' && !viteEnvironmentApi && isDefaultCombo

/**
 * True in exactly one fixture-matrix project (vite/built/default/manifest-on), and always true
 * outside the matrix. Guard suites that do not depend on any matrix axis with
 * `describe.skipIf(!runsOnceInMatrix)` so they run a single time instead of once per project.
 *
 * None of the `runsOnce*` guards hold in the projects re-running suites with a non-default option,
 * so a suite asserting on one of those options opts in with `|| inlineErrorRendering`.
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
export const runsOncePerBuilderInMatrix = !isMatrixRun || (isBuilt && isDefaultCombo)

/**
 * Like `runsOncePerEnvInMatrix` but keeps `experimental.viteEnvironmentApi`: true in one dev
 * and one built project for each of the `vite` and `vite-env-api` builders.
 */
export const runsOncePerViteBuilderInMatrix = !isMatrixRun || (!isWebpack && isDefaultCombo)

/**
 * True in one dev and one built project per builder, for behaviour that depends on the compiled
 * app. The webpack-based builders only have a dev project with async context.
 */
export const runsOncePerBuildInMatrix = !isMatrixRun || (!inlineErrorRendering && !legacyComponentResolution && isTestingAppManifest && isRenderingJson && (!asyncContext || (isWebpack && isDev)))

export const isNuxtPrepare = process.argv.slice(2).includes('prepare')

export function withMatrix (config: NuxtConfig) {
  return defu(config, {
    builder,
    devtools: { enabled: false },
    future: {
      typescriptBundlerResolution,
    },
    experimental: {
      asyncContext,
      appManifest: isTestingAppManifest,
      renderJsonPayloads: isRenderingJson,
      viteEnvironmentApi,
      ...inlineErrorRendering ? { inlineErrorRendering: true } : {},
      ...legacyComponentResolution ? { compilerComponentResolution: false } : {},
    },
    compatibilityDate: 'latest',
  })
}
