import type { ErrorReport, SourceLoader } from 'my-bad'
import type { SerializedErrorCause } from '#app/types'

import { isForwardingReports, publishErrorReport, requestIdOf } from './channel.ts'
import type { ErrorRequestInfo } from './channel.ts'

export type { SerializedErrorCause } from '#app/types'

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
  /** Whether the filesystem fallback may read a file, given its real path. Defaults to files within `cwd`. */
  canRead?: (file: string) => boolean
  /** Context the report's presets read. */
  context?: Record<string, unknown>
}

/** What the filesystem fallback may read, as Vite's resolved `server.fs` options. */
export interface DevErrorFsOptions {
  allow: string[]
  deny: string[]
  strict?: boolean
}

/**
 * A `canRead` check that allows real paths within `allow` and not matching `deny`, matched as
 * Vite matches `server.fs`.
 */
export async function createFsAccessCheck (fs: DevErrorFsOptions): Promise<(file: string) => boolean> {
  if (fs.strict === false) {
    return () => true
  }
  const [{ default: picomatch }, { existsSync, realpathSync }] = await Promise.all([import('picomatch'), import('node:fs')])
  const toRoot = (dir: string) => dir.replaceAll('\\', '/').replace(/\/$/, '')
  const roots = new Set<string>()
  for (const dir of fs.allow) {
    roots.add(toRoot(dir))
    if (existsSync(dir)) {
      roots.add(toRoot(realpathSync(dir)))
    }
  }
  const denied = picomatch(fs.deny.map(pattern => pattern.includes('/') ? pattern : `**/${pattern}`), { matchBase: false, nocase: true, dot: true })
  return (file) => {
    const path = file.replaceAll('\\', '/')
    return !denied(path) && [...roots].some(root => path === root || path.startsWith(`${root}/`))
  }
}

/** A filesystem loader reading only the real paths `canRead` allows, or files within `cwd` without it. */
export async function createReportFsLoader (options: Pick<ErrorReportOptions, 'cwd' | 'canRead'>): Promise<SourceLoader> {
  const [{ fsLoader }, { realpathSync }, { basename, dirname, join }] = await Promise.all([
    import('my-bad'),
    import('node:fs'),
    import('node:path'),
  ])
  const canRead = options.canRead
  if (!canRead) {
    return fsLoader({ roots: [options.cwd] })
  }
  const realPath = (file: string): string => {
    try {
      return realpathSync(file)
    } catch {
      const parent = dirname(file)
      return parent === file ? file : join(realPath(parent), basename(file))
    }
  }
  return fsLoader({ canRead: file => canRead(realPath(file).replaceAll('\\', '/')) })
}

/**
 * Build a report for an error raised while rendering. Must run before anything rewrites
 * `error.stack`, as frames are mapped by the loaders rather than read off the stack.
 */
export async function createErrorReport (error: unknown, options: ErrorReportOptions): Promise<ErrorReport> {
  const [{ createReport }, { nuxtPreset }, fs] = await Promise.all([
    import('my-bad'),
    import('my-bad/presets'),
    createReportFsLoader(options),
  ])
  return withoutEchoingCauses(await createReport(error, {
    cwd: options.cwd,
    loaders: [...options.loaders ?? [], fs],
    presets: [nuxtPreset()],
    context: { ...thrownContext(error), ...options.context },
  }))
}

interface ErrorRenderOptions {
  /** Project root, which report paths are relative to. */
  cwd: string
  /** Base path the live channel is served at. */
  channel: string
  /** Id of the request the page was rendered for, so it only follows reports about it. */
  requestId?: string
}

/** Add the error overlay to an already-rendered page. */
async function withErrorOverlay (html: string, report: ErrorReport, options: ErrorRenderOptions & { startMinimized?: boolean }): Promise<string> {
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
    nonce: SCRIPT_NONCE_RE.exec(html)?.[1] || undefined,
  })
}

/** The CSP nonce a page's scripts carry, when it is a valid one. */
const SCRIPT_NONCE_RE = /<script(?=[\s>])[^>]*?\snonce="([\w+/\-=]*)"/

/**
 * Render the badge for the head of a dev page, which shows the channel's errors and warnings
 * on it. The page reloads once its error clears, unless `window.__NUXT_DEV_ERROR__.recovers()`
 * reports that the app can update in place.
 */
export async function renderDevBadge (options: { cwd?: string, channel: string, request?: Pick<ErrorRequestInfo, 'headers'>, nonce?: string }): Promise<string> {
  const [{ renderBadge }, { nuxtTheme }] = await Promise.all([
    import('my-bad'),
    import('my-bad/presets'),
  ])
  const requestId = requestIdOf(options.request) ?? crypto.randomUUID()
  const state = JSON.stringify({ requestId }).replaceAll('<', '\\u003c')
  const nonce = options.nonce ? ` nonce="${options.nonce.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"` : ''
  return `<script${nonce}>window.__NUXT_DEV_ERROR__=${state};addEventListener('my-bad:error:clear',()=>__NUXT_DEV_ERROR__.recovers?.()||location.reload())</script>`
    + renderBadge({ channel: options.channel, cwd: options.cwd, theme: nuxtTheme, tag: 'nuxt-error-overlay', requestId, awaitHost: 500, nonce: options.nonce })
}

/** Render a standalone error page, for when the app itself cannot render one. */
async function renderErrorPage (report: ErrorReport, options: ErrorRenderOptions): Promise<string> {
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
async function renderErrorAnsi (report: ErrorReport, options: { cwd: string }): Promise<string> {
  const { renderAnsi } = await import('my-bad')
  return renderAnsi(withoutEchoingCauses(report), { cwd: options.cwd })
}

// eslint-disable-next-line no-control-regex -- control characters are exactly what is being stripped
const CONTROL_CHARACTER_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g

/** `text` without the C0 and C1 control characters, other than tab and newline, that could drive a terminal. */
export function stripControlCharacters (text: string): string {
  return text.replace(CONTROL_CHARACTER_RE, '')
}

/** Print a report to the terminal, falling back to the raw error when it cannot be rendered. */
async function printErrorReport (report: ErrorReport, options: { cwd: string, error?: unknown, request?: ErrorRequestInfo }): Promise<void> {
  const label = options.request ? ` [${options.request.method}] ${options.request.url.href}` : ''
  const rendered = await renderErrorAnsi(report, { cwd: options.cwd }).catch(() => undefined)
  if (rendered) {
    console.log(`[request error]${label}\n\n${rendered}`)
  } else {
    const error = options.error instanceof Error ? options.error.stack || options.error.message : options.error ?? report.message
    console.error(`[request error]${label}\n\n${stripControlCharacters(String(error))}`)
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
      // a file that does not compile is broken for every page, whichever request ran into it
      await publishErrorReport(report, isCompileFailure(report) ? undefined : request).catch(() => {})
    }
    if (observe.print !== false && !isForwardingReports()) {
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

/** Whether a report, or one of its causes, is a file that does not compile. */
function isCompileFailure (report: ErrorReport): boolean {
  return report.kind === 'compile' || report.causes.some(isCompileFailure) || !!report.errors?.some(isCompileFailure)
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
