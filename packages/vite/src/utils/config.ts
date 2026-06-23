import type { ResolvedConfig } from 'vite'
import { bundlerDiagnostics } from '@nuxt/kit'

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
