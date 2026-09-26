import { createError } from '../composables/error'

export const MAX_REDIRECTS = 10

/**
 * Throws a fatal error (500) when a redirect loop is detected.
 * In dev, logs a verbose warning with the target path and redirect count.
 */
export function failRedirectLoop (targetPath: string, redirectCount: number): never {
  if (import.meta.dev) {
    console.warn(
      `[nuxt] Redirect loop detected. Navigation to "${targetPath}" was aborted after ${redirectCount} redirects.\n` +
      `Check your route middleware and redirect rules for circular redirects.`,
    )
  }

  throw createError({
    status: 500,
    fatal: true,
    statusText: 'Too many redirects',
    data: { targetPath, redirectCount },
  })
}

/**
 * Tracks a redirect navigation in the chain. If the target repeats or
 * the chain exceeds MAX_REDIRECTS, calls failRedirectLoop.
 */
export function checkRedirectChain (chain: Set<string>, targetPath: string): void {
  if (chain.has(targetPath) || chain.size >= MAX_REDIRECTS) {
    failRedirectLoop(targetPath, chain.size)
  }

  chain.add(targetPath)
}
