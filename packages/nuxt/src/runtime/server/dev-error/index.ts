/**
 * Development error reporting shared by every server builder. Runtime-specific parts
 * (sourcemaps, where the channel is mounted, whether reports are forwarded) are passed in.
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
  /** Asks reporters to repeat their current report. */
  | { type: 'nuxt:dev:error:sync' }
  | { type: 'nuxt:dev:error:log', entry: LogEntry }
  | { type: 'nuxt:dev:error:warning', report: ErrorReport }
  | { type: 'nuxt:dev:error:progress', progress: BuildProgress }

const CHANNEL_KEY = Symbol.for('nuxt:dev:error-channel')

let isForwarding = (): boolean => false

/** Read lazily: a runtime may only learn whether it forwards after this module loads. */
export function configureErrorChannel (options: { forward: () => boolean }): void {
  isForwarding = options.forward
}

/**
 * The live error channel: a stub forwarding to the dev server in front where there is
 * one, so connected pages survive rebuilds, and otherwise a channel of this process,
 * shared through the global because module runners each evaluate this module.
 */
export function useErrorChannel (): Promise<Channel> {
  const store = globalThis as { [CHANNEL_KEY]?: Promise<Channel> }
  store[CHANNEL_KEY] ||= isForwarding()
    ? Promise.resolve(createForwardingChannel())
    : import('my-bad/channel').then(({ createChannel }) => createOwnedChannel(createChannel({ open: true })))
  return store[CHANNEL_KEY]
}

/** A channel of this process, which also accepts the reports other threads post. */
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

/** Publish a report as the current error, paired with the request it came from. */
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

/** Report what the server is busy with. A `percent` of 100 retires the progress bar. */
export async function publishDevProgress (progress: BuildProgress): Promise<void> {
  const channel = await useErrorChannel()
  channel.progress(progress)
}

export interface ErrorReportOptions {
  /** Project root, which report paths are relative to. */
  cwd: string
  /** Loaders resolving a frame to its source. A filesystem fallback is added last. */
  loaders?: SourceLoader[]
  /** Context the report's presets read, such as the request being handled. */
  context?: Record<string, unknown>
}

/**
 * Build a report for an error raised while rendering. Frames are mapped by the loaders
 * rather than read off the stack, so this must run before anything rewrites `error.stack`.
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

/** Render a report for the terminal. It carries its own icon and colours, so log it plainly. */
export async function renderErrorAnsi (report: ErrorReport, options: { cwd: string }): Promise<string> {
  const { renderAnsi } = await import('my-bad')
  return renderAnsi(withoutEchoingCauses(report), { cwd: options.cwd })
}

/** A line of a code frame, as a compiler embeds one in a message. */
const FRAME_LINE_RE = /^[^\S\n]*(?:\d+[^\S\n]*[|:│]|[|│][^\S\n]*\^|\^)/m

/**
 * Drop causes that only repeat the report's own message, so the failure is read once. A
 * wrapper is only dropped when all it adds is the code frame the report shows as a snippet.
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
 * Rewrite the module ids a transform failure names, and those of its causes, with
 * `resolve`. A bundler names the module it was serving, which is not always a path.
 */
export function resolveErrorPaths (error: unknown, resolve: (path: string) => string, seen = new Set<unknown>()): void {
  if (typeof error !== 'object' || error === null || seen.has(error)) {
    return
  }
  seen.add(error)
  const candidate = error as { id?: unknown, loc?: { file?: unknown }, cause?: unknown, errors?: unknown }
  if (typeof candidate.id === 'string') {
    candidate.id = resolve(candidate.id)
  }
  if (candidate.loc && typeof candidate.loc.file === 'string') {
    candidate.loc.file = resolve(candidate.loc.file)
  }
  resolveErrorPaths(candidate.cause, resolve, seen)
  if (Array.isArray(candidate.errors)) {
    for (const nested of candidate.errors) {
      resolveErrorPaths(nested, resolve, seen)
    }
  }
}

/** Flatten an error's `cause` chain into something the payload can carry. */
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
