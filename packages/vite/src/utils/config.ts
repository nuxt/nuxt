import type { ResolvedConfig } from 'vite'
import { ErrorCodes, buildErrorUtils } from '../nuxt-errors.ts'

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

  return buildErrorUtils.throw({ message: `No client entry found in \`rollupOptions.input\`. Expected an \`entry\` key or a string input. Received: ${JSON.stringify(input)}`, code: ErrorCodes.B7005, fix: 'Set `vite.build.rollupOptions.input` to a string or an object with an `entry` key in your `nuxt.config`.' })
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

  return buildErrorUtils.throw({ message: `No server entry found in \`rollupOptions.input\`. Expected a \`server\` key or a string input. Received: ${JSON.stringify(input)}`, code: ErrorCodes.B7006, fix: 'Set `vite.build.rollupOptions.input` to a string or an object with a `server` key in your `nuxt.config`.' })
}
