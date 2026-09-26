import type { ResolvedConfig } from 'vite'
import { bundlerDiagnostics } from '@nuxt/kit/internal'

/**
 * Resolve the client build manifest file name, relative to the client `outDir`,
 * honouring any `build.manifest` override from user config or a Vite plugin. This
 * is also the key the manifest is emitted under in the client bundle.
 */
export function resolveClientManifestFile (manifest: string | boolean | undefined) {
  if (!manifest) {
    throw bundlerDiagnostics.NUXT_B7020()
  }
  return manifest === true ? '.vite/manifest.json' : manifest
}

export function resolveClientEntry (config: ResolvedConfig) {
  const input = config.environments.client?.build.rolldownOptions.input ?? config.build.rolldownOptions.input
  if (input) {
    if (typeof input === 'string') {
      return input
    }
    if (!Array.isArray(input) && input.entry) {
      return input.entry
    }
  }

  throw bundlerDiagnostics.NUXT_B7005({ input: JSON.stringify(input) })
}

export function resolveServerEntry (config: ResolvedConfig) {
  const input = config.environments.ssr?.build.rolldownOptions.input ?? config.build.rolldownOptions.input
  if (input) {
    if (typeof input === 'string') {
      return input
    }
    if (!Array.isArray(input) && input.server) {
      return input.server
    }
  }

  throw bundlerDiagnostics.NUXT_B7006({ input: JSON.stringify(input) })
}
