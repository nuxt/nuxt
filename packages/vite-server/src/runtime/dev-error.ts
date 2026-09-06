import process from 'node:process'
import type { ViteDevServer } from 'vite'
import type { ErrorReport } from 'my-bad'
import { ERROR_CHANNEL_ENV, configureErrorChannel, createErrorReport, mapErrorStacktrace, publishErrorReport, renderErrorAnsi, renderErrorPage, serializeErrorCause, useErrorChannel, withErrorOverlay } from 'nuxt/internal/dev-error'
import type { SerializedErrorCause } from 'nuxt/internal/dev-error'

export { clearErrorReport } from 'nuxt/internal/dev-error'

/** What the dev server hands the runtime so it can report on what it renders. */
export interface DevErrorContext {
  /** The dev server whose module graph evaluated the app, and holds its sourcemaps. */
  server: ViteDevServer
  /** Project root, which report paths are relative to. */
  cwd: string
  /** Base path the live channel is reachable at, which rendered pages subscribe to. */
  channel: string
}

/** Set on each render, because this module is re-evaluated whenever the graph changes. */
let context: DevErrorContext | undefined

/**
 * Whether a dev server in front owns the channel, and so serves its routes, receives
 * the reports posted to the bridge and prints them.
 *
 * The announcement is enough on its own: this build renders in the process that dev
 * server runs in, so the bridge always reaches it.
 */
const forwarding = (): boolean => !!process.env[ERROR_CHANNEL_ENV]

configureErrorChannel({ forward: forwarding })

/**
 * Install the dev server the app renders from. Re-exported by the generated server
 * entry in development, so the dev server reaches it through the module graph the
 * render happens in.
 */
export function setDevErrorContext (next: DevErrorContext): void {
  context = next
  // opened eagerly so it is listening for the bundler's compile errors
  useErrorChannel().catch(() => {})
}

/**
 * Whether `pathname` is a live channel route this process serves. A dev server in front
 * mounts the channel itself and never forwards these requests.
 */
export function isErrorChannelRequest (pathname: string): boolean {
  if (!context || forwarding()) {
    return false
  }
  const base = context.channel.replace(/\/$/, '')
  return pathname === base || pathname.startsWith(`${base}/`)
}

/** Serve the live error channel: the SSE stream, report lookups and "open in editor". */
export async function fetchErrorChannel (request: Request): Promise<Response> {
  const response = await (await useErrorChannel()).fetchHandler(request)
  return response ?? new Response('Not Found', { status: 404 })
}

/**
 * Observe an error as it was raised: build a report from the unmapped stack, publish it,
 * then rewrite the stack in place so the error payload, the log and `error.vue` agree on
 * source positions.
 *
 * An `expected` error is the app working as intended (a 404, a failed validation), and
 * gets no report.
 */
export async function observeError (error: unknown, request: Request, options: { expected?: boolean } = {}): Promise<ErrorReport | undefined> {
  if (!context) {
    return undefined
  }
  const report = options.expected ? undefined : await buildReport(error).catch(() => undefined)
  const { server } = context
  mapErrorStacktrace(error, stack => fixStacktrace(server, stack))
  if (report) {
    const url = new URL(request.url)
    await publishErrorReport(report, { method: request.method, url, headers: request.headers }).catch(() => {})
    // a dev server that owns the channel prints the reports it is sent
    if (!forwarding()) {
      const rendered = await renderErrorAnsi(report, { cwd: context.cwd }).catch(() => undefined)
      console.log(`[request error] [${request.method}] ${url.pathname}${url.search}\n\n${rendered ?? String((error as Error)?.stack || error)}`)
    }
  }
  return report
}

async function buildReport (error: unknown): Promise<ErrorReport> {
  const { viteLoader } = await import('my-bad/vite')
  return createErrorReport(error, {
    cwd: context!.cwd,
    // sources are read by the filesystem loader the report adds after this one
    loaders: [viteLoader(ssrOnly(context!.server), { fs: false })],
  })
}

/**
 * The dev server with only its SSR environment visible. `viteLoader` maps a frame through
 * the first environment whose graph holds the file, and an SSR frame has to be mapped
 * through the transform that produced it rather than the browser's.
 */
function ssrOnly (server: ViteDevServer): ViteDevServer {
  return Object.create(server, { environments: { value: { ssr: server.environments.ssr } } }) as ViteDevServer
}

/**
 * Vite maps a stack in place, and appends to `message` when it detects one it has already
 * rewritten, so a throwaway carrier is mapped rather than the error itself.
 */
function fixStacktrace (server: ViteDevServer, stack: string): string {
  const carrier = { stack } as Error
  server.ssrFixStacktrace(carrier)
  return carrier.stack ?? stack
}

/** The error's `cause` chain, as the error page receives it in the payload. */
export function errorCause (error: unknown): SerializedErrorCause | undefined {
  return serializeErrorCause((error as { cause?: unknown } | undefined)?.cause)
}

/** Add the report to the error page the app rendered, a click away. */
export function overlayErrorReport (html: string, report: ErrorReport): Promise<string> {
  return withErrorOverlay(html, report, { cwd: context!.cwd, channel: channelPath(), startMinimized: true })
}

/** Render the report as a standalone page, for when the app cannot render its error page. */
export function renderReportPage (report: ErrorReport): Promise<string> {
  return renderErrorPage(report, { cwd: context!.cwd, channel: channelPath() })
}

/** Base path pages should subscribe to, as the dev server in front mounts it. */
function channelPath (): string {
  return process.env[ERROR_CHANNEL_ENV] || context!.channel
}
