/**
 * Server-side diagnostics-channel tracing helper for Nuxt-owned subsystems.
 *
 * Channels published via this helper:
 * - `nuxt.render` (page-level Vue render, both buffered `renderToString` and
 *   streamed responses; payload includes `streaming: boolean`)
 * - `nuxt.island` (per-island `renderToString`)
 * - `nuxt.data` (`useAsyncData` / `useFetch` handler executions)
 * - `nuxt.plugin` (Nuxt app plugin invocations)
 *
 * Channel names follow the [untracing](https://github.com/unjs/untracing)
 * `{namespace}.{operation}` convention.
 *
 * Callers are responsible for gating on `tracingChannelNuxt` and
 * `import.meta.server`; this module only probes for `node:diagnostics_channel`
 * at runtime.
 *
 * @experimental Channel names, payload shapes, and option keys may change.
 */

type TracingChannel<C> = {
  hasSubscribers: boolean | undefined
  tracePromise<T> (fn: (...args: any[]) => Promise<T> | T, context: C, ...args: unknown[]): Promise<T>
}

let _channels: Record<string, TracingChannel<any> | null> | undefined

function getChannel<C> (name: string): TracingChannel<C> | null {
  _channels ??= {}
  if (name in _channels) {
    return _channels[name] as TracingChannel<C> | null
  }
  // Probe via `process.getBuiltinModule` so unsupported runtimes (workerd
  // without `nodejs_compat`, browsers reached via mis-bundling) return `null`
  // instead of throwing a module-resolution error.
  const dc = (globalThis as any).process?.getBuiltinModule?.('node:diagnostics_channel')
  const channel = dc?.tracingChannel ? (dc.tracingChannel(name) as TracingChannel<C>) : null
  _channels[name] = channel
  return channel
}

/**
 * Wrap a (possibly sync) function with a tracing channel. When the channel is
 * unavailable or has no subscribers, the helper returns `fn()` directly so
 * sync callers don't pay an extra microtask hop; when there is a subscriber it
 * delegates to `tracingChannel.tracePromise`, which emits `start`, `end`,
 * `asyncStart`, `asyncEnd`, and `error` sub-channels per Node's
 * `TracingChannel` API.
 *
 * The return type is overloaded: an always-async `fn` produces an always-async
 * result (so call sites can `.then` / `.catch` directly), while a possibly-sync
 * `fn` produces `Promise<T> | T` and the call site is expected to `await` it.
 */
export function traceAsync<T, C> (name: string, context: C, fn: () => Promise<T>): Promise<T>
export function traceAsync<T, C> (name: string, context: C, fn: () => Promise<T> | T): Promise<T> | T
export function traceAsync<T, C> (name: string, context: C, fn: () => Promise<T> | T): Promise<T> | T {
  const channel = getChannel<C>(name)
  // Skip only when we *know* there are zero subscribers. Bun's top-level
  // `TracingChannel` reports `hasSubscribers` as `undefined` even when its
  // sub-channels are subscribed (oven-sh/bun#27805), so treating `undefined`
  // as "unsubscribed" would silently disable tracing on Bun.
  if (!channel || channel.hasSubscribers === false) {
    return fn()
  }
  return channel.tracePromise(fn, context)
}
