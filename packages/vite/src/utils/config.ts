import type { ResolvedConfig } from 'vite'

export function resolveClientEntry (config: ResolvedConfig) {
  const input = config.environments.client?.build.rollupOptions.input ?? config.build.rollupOptions.input
  if (input) {
    if (typeof input === 'string') {
      return input
    }
    if (!Array.isArray(input) && input.entry) {
      return input.entry
    }
  }

  throw new Error('No entry found in rollupOptions.input')
}

export function resolveServerEntry (config: ResolvedConfig) {
  const input = config.environments.ssr?.build.rollupOptions.input ?? config.build.rollupOptions.input
  if (input) {
    if (typeof input === 'string') {
      return input
    }
    if (!Array.isArray(input) && input.server) {
      return input.server
    }
  }

  throw new Error('No entry found in rollupOptions.input')
}
