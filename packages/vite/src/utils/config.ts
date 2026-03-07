import type { ResolvedConfig } from 'vite'

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

  throw new Error(`[nuxt] No client entry found in \`rollupOptions.input\`. Expected an \`entry\` key or a string input. Received: ${JSON.stringify(input)}`)
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

  throw new Error(`[nuxt] No server entry found in \`rollupOptions.input\`. Expected a \`server\` key or a string input. Received: ${JSON.stringify(input)}`)
}
