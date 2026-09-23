/**
 * Development error reporting shared by every server builder.
 *
 * @module nuxt/internal/dev-error
 */
import type { BuildProgress, Channel, LogEntry } from 'my-bad/channel'
import type { ErrorReport, SourceLoader } from 'my-bad'
import type { SerializedErrorCause } from '#app/types'

export type { SerializedErrorCause } from '#app/types'

/** Base path the dev server owning the channel serves it at. */
export const ERROR_CHANNEL_ENV = 'NUXT_DEV_ERROR_CHANNEL'

/** `BroadcastChannel` name reports are forwarded on. */
export const ERROR_CHANNEL_BROADCAST = 'nuxt:dev:error'

/** Pairs a report with the request it came from. */
export const REQUEST_ID_HEADER = 'x-nuxt-dev-request-id'

export type ErrorChannelMessage =
  | {
    type: 'nuxt:dev:error:report'
    report: ErrorReport
    requestId?: string
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

/**
 * Whether reports are forwarded to a dev server in front rather than served from here.
 * Read when the channel is first used, not when this module loads.
 */
export function setErrorChannelForwarding (forward: () => boolean): void {
  isForwarding = forward
}

/** The live error channel, forwarding to the dev server in front when there is one. */
export function useErrorChannel (): Promise<Channel> {
  const store = globalThis as { [CHANNEL_KEY]?: Promise<Channel> }
  store[CHANNEL_KEY] ||= isForwarding()
    ? Promise.resolve(createForwardingChannel())
    : import('my-bad/channel').then(({ createChannel }) => createOwnedChannel(createChannel({ open: true })))
  return store[CHANNEL_KEY]
}

/** The `BroadcastChannel` reports travel between threads on, which must not hold the process open. */
function openBroadcast (): { broadcast: BroadcastChannel, post: (message: ErrorChannelMessage) => void } {
  const broadcast = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
  ;(broadcast as { unref?: () => void }).unref?.()
  return { broadcast, post: message => broadcast.postMessage(message) }
}

/** A channel of this process, which also relays reports to and from other threads. */
function createOwnedChannel (channel: Channel): Channel {
  const { broadcast, post } = openBroadcast()
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
  post({ type: 'nuxt:dev:error:sync' })
  return {
    ...channel,
    setError (report, requestId?: string, request?: string) {
      channel.setError(report, requestId, request)
      post({ type: 'nuxt:dev:error:report', report, requestId, request })
    },
    clearError (id) {
      channel.clearError(id)
      post({ type: 'nuxt:dev:error:clear', id })
    },
    get current () {
      return channel.current
    },
    get clients () {
      return channel.clients
    },
    get history () {
      return channel.history
    },
  }
}

function createForwardingChannel (): Channel {
  const { broadcast, post } = openBroadcast()
  let current: ErrorReport | undefined
  return {
    handler: () => Promise.resolve(false),
    fetchHandler: () => Promise.resolve(undefined),
    setError (report, requestId?: string, request?: string) {
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

/** The request a report is about. */
export interface ErrorRequestInfo {
  method: string
  url: URL
  headers: Headers
}

/** Publish a report as the current error, paired with the request it came from. */
export async function publishErrorReport (report: ErrorReport, request?: ErrorRequestInfo): Promise<void> {
  const channel = await useErrorChannel()
  const description = request && `${request.method} ${request.url.pathname}${request.url.search}`
  channel.setError(report, requestIdOf(request), description)
}

/** The id a dev server in front gave the request. */
export function requestIdOf (request?: Pick<ErrorRequestInfo, 'headers'>): string | undefined {
  return request?.headers.get(REQUEST_ID_HEADER) ?? undefined
}

/** Retire the current report, dismissing overlays showing it. */
export async function clearErrorReport (): Promise<void> {
  const channel = await useErrorChannel()
  if (channel.current) {
    channel.clearError()
  }
}

/** Stream a log entry to connected error pages and overlays. */
export async function publishDevLog (entry: Omit<LogEntry, 'timestamp'> & { timestamp?: number }): Promise<void> {
  const channel = await useErrorChannel()
  channel.log(entry)
}

/** Report build progress. A `percent` of 100 retires the progress bar. */
export async function publishDevProgress (progress: BuildProgress): Promise<void> {
  const channel = await useErrorChannel()
  channel.progress(progress)
}

const THROWN_CONTEXT = Symbol.for('nuxt:dev:context')

/** The component instance and route the app recorded on `error` when it threw. */
export function thrownContext (error: unknown): { instance?: unknown, route?: unknown } {
  const context = typeof error === 'object' && error !== null && THROWN_CONTEXT in error
    ? (error as { [THROWN_CONTEXT]?: { instance?: unknown, route?: unknown } })[THROWN_CONTEXT]
    : undefined
  return context ?? {}
}

export interface ErrorReportOptions {
  /** Project root, which report paths are relative to. */
  cwd: string
  /** Loaders resolving a frame to its source. A filesystem fallback is added last. */
  loaders?: SourceLoader[]
  /** Context the report's presets read. */
  context?: Record<string, unknown>
}

/**
 * Build a report for an error raised while rendering. Must run before anything rewrites
 * `error.stack`, as frames are mapped by the loaders rather than read off the stack.
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
    context: { ...thrownContext(error), ...options.context },
  }))
}

export interface ErrorRenderOptions {
  /** Project root, which report paths are relative to. */
  cwd: string
  /** Base path the live channel is served at. */
  channel: string
  /** Id of the request the page was rendered for, so it only follows reports about it. */
  requestId?: string
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
    requestId: options.requestId,
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
    requestId: options.requestId,
    theme: nuxtTheme,
  })
}

/** Render a report for the terminal. It carries its own icon and colours. */
export async function renderErrorAnsi (report: ErrorReport, options: { cwd: string }): Promise<string> {
  const { renderAnsi } = await import('my-bad')
  return renderAnsi(withoutEchoingCauses(report), { cwd: options.cwd })
}

/** Print a report to the terminal, falling back to the raw error when it cannot be rendered. */
async function printErrorReport (report: ErrorReport, options: { cwd: string, error?: unknown, request?: ErrorRequestInfo }): Promise<void> {
  const label = options.request ? ` [${options.request.method}] ${options.request.url.href}` : ''
  const rendered = await renderErrorAnsi(report, { cwd: options.cwd }).catch(() => undefined)
  if (rendered) {
    console.log(`[request error]${label}\n\n${rendered}`)
  } else {
    console.error(`[request error]${label}\n\n`, options.error ?? report.message)
  }
}

/** What the builder provides so errors raised while it serves the app can be reported. */
export interface DevErrorReporterOptions<E> {
  /** Project root, which report paths are relative to. */
  cwd: string
  /** Base path the live channel is reachable at, read per report. */
  channel: () => string
  /** Build a report for an error, mapping frames through the builder's sourcemaps. */
  createReport: (error: unknown, event?: E) => Promise<ErrorReport>
  /** The request a report is about, as read from the builder's own event. */
  requestInfo: (event: E) => ErrorRequestInfo
  /** Rewrite the error's stack in place with source positions, once the report is built. */
  mapStack?: (error: unknown) => void
}

export interface DevErrorObserveOptions {
  /** The error is the app working as intended, so no report is built for it. */
  expected?: boolean
  /** Defaults to `true`. */
  publish?: boolean
  /** Defaults to `true`, and never prints when a dev server in front owns the channel. */
  print?: boolean
}

export interface DevErrorReport {
  report: ErrorReport
  /** Add the report to a page the app rendered, a click away. */
  overlay: (html: string) => Promise<string>
  /** Render the report as a standalone page, for when the app cannot render its own. */
  page: () => Promise<string>
}

/**
 * Build the reporter a builder hands the renderer as `onDevError`. The report is built on the
 * stack as raised, so this must run before anything rewrites it.
 */
export function createDevErrorReporter<E> (options: DevErrorReporterOptions<E>): (error: unknown, event?: E, observe?: DevErrorObserveOptions) => Promise<DevErrorReport | undefined> {
  return async function observeDevError (error, event, observe = {}) {
    const request = event && options.requestInfo(event)
    const report = observe.expected ? undefined : await options.createReport(error, event).catch(() => undefined)
    options.mapStack?.(error)
    if (!report) {
      return undefined
    }
    if (observe.publish !== false) {
      await publishErrorReport(report, request).catch(() => {})
    }
    if (observe.print !== false && !isForwarding()) {
      await printErrorReport(report, { cwd: options.cwd, error, request })
    }
    const requestId = requestIdOf(request)
    return {
      report,
      overlay: html => withErrorOverlay(html, report, { cwd: options.cwd, channel: options.channel(), requestId, startMinimized: true }),
      page: () => renderErrorPage(report, { cwd: options.cwd, channel: options.channel(), requestId }),
    }
  }
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
