import { defu } from 'defu'
import type { NuxtConfig } from 'nuxt/schema'

export const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'

export const isDev = process.env.TEST_ENV === 'dev'
export const isBuilt = !isDev

const _builder = process.env.TEST_BUILDER as 'webpack' | 'rspack' | 'vite' | 'vite-env-api'
export const builder = _builder === 'vite-env-api' ? 'vite' : (_builder ?? 'vite')

export const isTestingAppManifest = process.env.TEST_MANIFEST !== 'manifest-off'

export const isV4 = process.env.TEST_V4 === 'true'

export const asyncContext = process.env.TEST_CONTEXT === 'async'
export const typescriptBundlerResolution = process.env.MODULE_RESOLUTION !== 'node'

export const isRenderingJson = process.env.TEST_PAYLOAD !== 'js'

export function withMatrix (config: NuxtConfig) {
  return defu(config, {
    builder,
    future: {
      typescriptBundlerResolution,
      compatibilityVersion: isV4 ? 4 : 3,
    },
    experimental: {
      asyncContext,
      appManifest: isTestingAppManifest,
      renderJsonPayloads: isRenderingJson,
      viteEnvironmentApi: _builder === 'vite-env-api',
    },
    compatibilityDate: 'latest',
  })
}
