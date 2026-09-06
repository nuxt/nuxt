/**
 * The development error report every server builder shares: how a report is built
 * from an error, how it is rendered, and the live channel error pages and overlays
 * subscribe to.
 *
 * Anything runtime-specific (where sourcemaps come from, where the channel is
 * mounted, whether reports are forwarded) is passed in by the server runtime.
 *
 * @module nuxt/internal/dev-error
 */
import type { BuildProgress, Channel, LogEntry } from 'my-bad/channel'
import type { ErrorReport, SourceLoader } from 'my-bad'
import type { SerializedErrorCause } from '#app/types'

export type { SerializedErrorCause } from '#app/types'

/** Set by a dev server that owns the channel, to the base path it serves it at. */
export const ERROR_CHANNEL_ENV = 'NUXT_DEV_ERROR_CHANNEL'

/** `BroadcastChannel` name reports are forwarded on to the owning dev server. */
export const ERROR_CHANNEL_BROADCAST = 'nuxt:dev:error'

/** Set by a dev server so a report can be paired with its request. */
export const REQUEST_ID_HEADER = 'x-nuxt-dev-request-id'

export type ErrorChannelMessage =
  | {
    type: 'nuxt:dev:error:report'
    report: ErrorReport
    requestId?: number
    /** The request that failed, as `METHOD /path`. */
    request?: string
  }
  | { type: 'nuxt:dev:error:clear', id?: string }
  /** Sent when a channel starts listening, so reporters repeat their current report. */
  | { type: 'nuxt:dev:error:sync' }
  | { type: 'nuxt:dev:error:log', entry: LogEntry }
  | { type: 'nuxt:dev:error:warning', report: ErrorReport }
  | { type: 'nuxt:dev:error:progress', progress: BuildProgress }

const CHANNEL_KEY = Symbol.for('nuxt:dev:error-channel')

let isForwarding = (): boolean => false

/**
 * Declare how the channel should be created when something first uses it. Read lazily,
 * because a runtime may only learn the answer after this module is loaded.
 */
export function configureErrorChannel (options: { forward: () => boolean }): void {
  isForwarding = options.forward
}

/**
 * The live error channel.
 *
 * When a dev server in front owns the channel, this is a stub that posts reports to
 * it, so history, sinks and connected pages survive rebuilds of the rendering process.
 * Otherwise it is created here on first use, and shared through the global: the
 * renderer, the error handler and whatever mounts the channel may be evaluated by
 * different module runners in one process.
 */
export function useErrorChannel (): Promise<Channel> {
  const store = globalThis as { [CHANNEL_KEY]?: Promise<Channel> }
  store[CHANNEL_KEY] ||= isForwarding()
    ? Promise.resolve(createForwardingChannel())
    : import('my-bad/channel').then(({ createChannel }) => createOwnedChannel(createChannel({ open: true })))
  return store[CHANNEL_KEY]
}

/**
 * A channel served from this process, which also accepts the reports other
 * threads post, such as compile errors from the bundler.
 */
function createOwnedChannel (channel: Channel): Channel {
  const broadcast = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
  ;(broadcast as { unref?: () => void }).unref?.()
  broadcast.onmessage = (event) => {
    const message = event.data as ErrorChannelMessage
    switch (message?.type) {
      case 'nuxt:dev:error:report':
        return channel.setError(message.report)
      case 'nuxt:dev:error:clear':
        return channel.clearError(message.id)
      case 'nuxt:dev:error:log':
        return channel.log(message.entry)
      case 'nuxt:dev:error:warning':
        return channel.warn(message.report)
      case 'nuxt:dev:error:progress':
        return channel.progress(message.progress)
    }
  }
  broadcast.postMessage({ type: 'nuxt:dev:error:sync' } satisfies ErrorChannelMessage)
  return channel
}

function createForwardingChannel (): Channel {
  const broadcast = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
  ;(broadcast as { unref?: () => void }).unref?.()
  const post = (message: ErrorChannelMessage) => broadcast.postMessage(message)
  let current: ErrorReport | undefined
  return {
    handler: () => Promise.resolve(false),
    fetchHandler: () => Promise.resolve(undefined),
    setError (report, requestId?: number, request?: string) {
      current = report
      post({ type: 'nuxt:dev:error:report', report, requestId, request })
    },
    clearError (id) {
      current = undefined
      post({ type: 'nuxt:dev:error:clear', id })
    },
    warn (report) {
      post({ type: 'nuxt:dev:error:warning', report })
    },
    log (entry) {
      post({ type: 'nuxt:dev:error:log', entry: { timestamp: Date.now(), ...entry } })
    },
    progress (progress) {
      post({ type: 'nuxt:dev:error:progress', progress })
    },
    get current () {
      return current
    },
    history: [],
    getReport: () => undefined,
    clients: 0,
    close () {
      broadcast.close()
    },
  }
}

/** The request a report is about, in terms every server runtime can describe it in. */
export interface ErrorRequestInfo {
  method: string
  url: URL
  headers: Headers
}

/**
 * Publish a report as the current error, paired with the request it came from when the
 * dev server in front identified one.
 */
export async function publishErrorReport (report: ErrorReport, request?: ErrorRequestInfo): Promise<void> {
  const channel = await useErrorChannel()
  const header = request?.headers.get(REQUEST_ID_HEADER)
  const requestId = header ? Number(header) : Number.NaN
  const description = request && `${request.method} ${request.url.pathname}${request.url.search}`
  ;(channel.setError as (report: ErrorReport, requestId?: number, request?: string) => void)(report, Number.isFinite(requestId) ? requestId : undefined, description)
}

/** Retire the current report, so overlays showing it are dismissed. */
export async function clearErrorReport (): Promise<void> {
  const channel = await useErrorChannel()
  if (channel.current) {
    channel.clearError()
  }
}

/** Stream a log entry to the log drawer of connected error pages and overlays. */
export async function publishDevLog (entry: Omit<LogEntry, 'timestamp'> & { timestamp?: number }): Promise<void> {
  const channel = await useErrorChannel()
  channel.log(entry)
}

/**
 * Report what the server is busy with on the progress bar of connected error pages and
 * overlays. A `percent` of 100 retires the bar.
 */
export async function publishDevProgress (progress: BuildProgress): Promise<void> {
  const channel = await useErrorChannel()
  channel.progress(progress)
}

export interface ErrorReportOptions {
  /** Project root, which report paths are relative to. */
  cwd: string
  /**
   * Loaders resolving a frame to its source, from whatever the runtime's bundler
   * exposes of the SSR sourcemaps. A filesystem fallback is added last.
   */
  loaders?: SourceLoader[]
  /** Arbitrary context the report's presets read, such as the request being handled. */
  context?: Record<string, unknown>
}

/**
 * Build a report for an error raised while rendering. Frames are mapped by the loaders
 * rather than read off the stack, so this must run before anything rewrites
 * `error.stack`.
 *
 * Causes that only repeat the report's own message are left out, so every consumer of the
 * report shows the failure once.
 */
export async function createErrorReport (error: unknown, options: ErrorReportOptions): Promise<ErrorReport> {
  const [{ createReport, fsLoader }, { nuxtPreset }] = await Promise.all([
    import('my-bad'),
    import('my-bad/presets'),
  ])
  return withoutEchoingCauses(await createReport(error, {
    cwd: options.cwd,
    loaders: [...options.loaders ?? [], fsLoader()],
    presets: [nuxtPreset()],
    context: options.context,
  }))
}

export interface ErrorRenderOptions {
  /** Project root, which report paths are relative to. */
  cwd: string
  /** Base path the live channel is served at, which the rendered client subscribes to. */
  channel: string
}

/** Add the error overlay to an already-rendered page. */
export async function withErrorOverlay (html: string, report: ErrorReport, options: ErrorRenderOptions & { startMinimized?: boolean }): Promise<string> {
  const [{ injectOverlay }, { nuxtTheme }] = await Promise.all([
    import('my-bad'),
    import('my-bad/presets'),
  ])
  return injectOverlay(html, report, {
    cwd: options.cwd,
    channel: options.channel,
    theme: nuxtTheme,
    tag: 'nuxt-error-overlay',
    startMinimized: options.startMinimized,
  })
}

/** Render a standalone error page, for when the app itself cannot render one. */
export async function renderErrorPage (report: ErrorReport, options: ErrorRenderOptions): Promise<string> {
  const [{ renderPage }, { nuxtTheme }] = await Promise.all([
    import('my-bad'),
    import('my-bad/presets'),
  ])
  return renderPage(report, {
    cwd: options.cwd,
    channel: options.channel,
    theme: nuxtTheme,
  })
}

/**
 * Render a report for the terminal, with the project root shortened to `.`. It carries its
 * own icon and colours, so log it plainly rather than at a logger's error level.
 */
export async function renderErrorAnsi (report: ErrorReport, options: { cwd: string }): Promise<string> {
  const { renderAnsi } = await import('my-bad')
  return renderAnsi(withoutEchoingCauses(report), { cwd: options.cwd })
}

/** A line of a code frame, as a compiler embeds one in a message. */
const FRAME_LINE_RE = /^[^\S\n]*(?:\d+[^\S\n]*[|:│]|[|│][^\S\n]*\^|\^)/m

/**
 * Drop causes that only repeat the report's own message.
 *
 * A compile error is hoisted to the top of the report, and the error it arrived wrapped in
 * carries the same message, so the developer would otherwise read it twice. A wrapper is
 * only dropped when everything it adds is the code frame the compiler embedded, which the
 * report already shows as a snippet.
 */
function withoutEchoingCauses (report: ErrorReport): ErrorReport {
  const causes = report.causes.filter(cause => !echoesMessage(cause.message, report.message)).map(withoutEchoingCauses)
  return causes.length === report.causes.length ? report : { ...report, causes }
}

function echoesMessage (candidate: string, message: string): boolean {
  if (candidate === message) {
    return true
  }
  if (!candidate.startsWith(message)) {
    return false
  }
  const remainder = candidate.slice(message.length)
  return remainder.trim() === '' || FRAME_LINE_RE.test(remainder)
}

/**
 * Rewrite the stack positions of an error, and of every error it was caused by, from
 * the positions of the code the bundler served to source positions. Errors surfaced by
 * the Vue app are wrapped, so user frames are on `cause`.
 */
export function mapErrorStacktrace (error: unknown, fixStacktrace: (stack: string) => string, seen = new Set<unknown>()): void {
  if (!(error instanceof Error) || seen.has(error)) {
    return
  }
  seen.add(error)
  if (typeof error.stack === 'string') {
    const stack = fixStacktrace(error.stack)
    if (stack !== error.stack) {
      error.stack = stack
    }
  }
  mapErrorStacktrace(error.cause, fixStacktrace, seen)
}

/**
 * Flatten an error's `cause` chain into something the payload can carry, so `error.vue`
 * can show the frames of the code that actually failed.
 */
export function serializeErrorCause (cause: unknown, depth = 0, seen = new WeakSet<Error>()): SerializedErrorCause | undefined {
  if (depth >= 10 || (cause instanceof Error && seen.has(cause))) { return }
  if (cause instanceof Error) {
    seen.add(cause)
    const nestedCause = serializeErrorCause(cause.cause, depth + 1, seen)
    return {
      name: cause.name,
      message: cause.message,
      ...(cause.stack && { stack: cause.stack }),
      ...(nestedCause !== undefined && { cause: nestedCause }),
    }
  }
  if (cause === null || typeof cause === 'string' || typeof cause === 'number' || typeof cause === 'boolean') {
    return cause
  }
}
