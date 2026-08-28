/**
 * Server-side diagnostics-channel tracing helper for Nuxt-owned subsystems.
 *
 * Channels published via this helper:
 * - `nuxt.render` (page-level Vue render, both buffered `renderToString` and
 *   streamed responses; payload includes `streaming: boolean`)
 * - `nuxt.island` (per-island `renderToString`)
 * - `nuxt.data` (`useAsyncData` / `useFetch` handler executions)
 * - `nuxt.plugin` (Nuxt app plugin invocations)
 * - `nuxt.middleware` (Nuxt route middleware invocations during SSR)
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

type ServerTimingMetric = {
  name: string
  duration: number
  description?: string
}

type ServerTimingCarrier = {
  ['~serverTiming']?: ServerTimingMetric[]
}

const TOKEN_RE = /[^\w!#$%&'*+.^`|~-]/g

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

function formatDuration (duration: number) {
  const value = Math.max(0, duration)
  const rounded = Math.round(value * 1000) / 1000
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function sanitizeToken (name: string) {
  const token = name.replace(TOKEN_RE, '-')
  return token || 'nuxt'
}

function escapeDescription (description: string) {
  return description.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function formatMetric (metric: ServerTimingMetric) {
  if (!Number.isFinite(metric.duration)) {
    return ''
  }
  const name = sanitizeToken(metric.name)
  const dur = `dur=${formatDuration(metric.duration)}`
  if (!metric.description) {
    return `${name};${dur}`
  }
  return `${name};${dur};desc="${escapeDescription(metric.description)}"`
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

export function addServerTimingMetric (carrier: ServerTimingCarrier | undefined, metric: ServerTimingMetric): void {
  if (!carrier || !Number.isFinite(metric.duration)) {
    return
  }
  ;(carrier['~serverTiming'] ||= []).push(metric)
}

export function appendServerTimingHeader (headers: Headers, carrier: ServerTimingCarrier | undefined): void {
  if (!carrier?.['~serverTiming']?.length) {
    return
  }

  const serialized = carrier['~serverTiming'].map(formatMetric).filter(Boolean).join(', ')
  if (!serialized) {
    return
  }

  const existing = headers.get('server-timing')
  headers.set('server-timing', existing ? `${existing}, ${serialized}` : serialized)
}
