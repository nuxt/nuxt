import type { ResolvedConfig } from 'vite'

export function resolveEntry (config: ResolvedConfig) {
  const input = config.build.rollupOptions.input
  if (input && typeof input !== 'string' && !Array.isArray(input) && input.entry) {
    return input.entry
  }

  throw new Error('No entry found in rollupOptions.input')
}
