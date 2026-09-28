import { tracingChannel } from 'node:diagnostics_channel'
import type { TracingChannel } from 'node:diagnostics_channel'
import type { Nuxt } from '@nuxt/schema'

const channels: Record<string, TracingChannel<unknown, object>> = {}

export function isBundlerTracingEnabled (nuxt: Nuxt): boolean {
  const options = nuxt.options.tracingChannel
  return !!(options && typeof options === 'object' && options.nuxt)
}

/**
 * Publishes `nuxt.bundler.module` (`{ id, environment }`) and `nuxt.bundler.plugin`
 * (`{ plugin, hook, id?, environment? }`) spans.
 *
 * @experimental Channel names and payload shapes may change.
 */
export function traceAsync<T> (name: string, context: object, fn: () => Promise<T> | T): Promise<T> | T {
  const channel = channels[name] ??= tracingChannel(name)
  // oven-sh/bun#27805
  if ((channel as { hasSubscribers?: boolean }).hasSubscribers === false) {
    return fn()
  }
  return channel.tracePromise(() => Promise.resolve(fn()), context)
}
