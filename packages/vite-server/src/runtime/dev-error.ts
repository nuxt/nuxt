import type { ViteDevServer } from 'vite'
import type { ViteHotContext } from 'vite/types/hot.d.ts'
import type { ErrorReport } from 'my-bad'
import { ERROR_CHANNEL_ENV, clearErrorReport as clearChannelReport, createDevErrorReporter, createErrorReport, serializeErrorCause, setErrorChannelForwarding, useErrorChannel } from 'nuxt/internal/dev-error'
import type { DevErrorObserveOptions, DevErrorReport, SerializedErrorCause } from 'nuxt/internal/dev-error'
import { isLoopbackAddress } from 'nuxt/internal/dev/peer'

import { REMOTE_DEV_ERROR_CLEAR_EVENT, REMOTE_DEV_ERROR_EVENT, REMOTE_DEV_ERROR_REPORT_EVENT } from './remote-dev-error.ts'
import type { RemoteDevError, RemoteDevErrorReport } from './remote-dev-error.ts'

/** What the dev server hands the runtime so it can report on what it renders. */
export interface DevErrorContext {
  /** The dev server whose module graph evaluated the app, and holds its sourcemaps. */
  server: ViteDevServer
  /** Project root, which report paths are relative to. */
  cwd: string
  /** Base path the live channel is reachable at. */
  channel: string
}

let context: DevErrorContext | undefined

const env = (): Record<string, string | undefined> => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

/** Whether a dev server in front owns the channel. */
const forwarding = (): boolean => !!env()[ERROR_CHANNEL_ENV]

const hot = (import.meta as ImportMeta & { hot?: ViteHotContext }).hot

setErrorChannelForwarding(forwarding)

/** Install the dev server the app renders from. */
export function setDevErrorContext (next: DevErrorContext): void {
  context = next
  // opened eagerly so it is listening for the bundler's compile errors
  useErrorChannel().catch(() => {})
}

/** Whether `pathname` is a live channel route this process serves. */
export function isErrorChannelRequest (pathname: string): boolean {
  if (!context || forwarding()) {
    return false
  }
  const base = context.channel.replace(/\/$/, '')
  return pathname === base || pathname.startsWith(`${base}/`)
}

/**
 * Serve the live error channel: the SSE stream, report lookups and "open in editor".
 *
 * Trust follows the socket, since a request's origin headers are forgeable over a direct
 * connection.
 */
export async function fetchErrorChannel (request: Request & { ip?: string }): Promise<Response> {
  const response = await (await useErrorChannel()).fetchHandler(request, { trusted: isLoopbackAddress(request.ip) })
  return response ?? new Response('Not Found', { status: 404 })
}

/**
 * Build a report from the stack as raised, publish it, then rewrite the stack in place so
 * every later consumer sees source positions.
 */
export function observeDevError (error: unknown, request?: Request, observe?: DevErrorObserveOptions): Promise<DevErrorReport | undefined> {
  if (context) {
    return reporter(error, request, observe)
  }
  if (hot && !observe?.expected) {
    return requestRemoteReport(error, request).catch(() => undefined)
  }
  return Promise.resolve(undefined)
}

/** Retire the current report, dismissing overlays showing it. */
export function clearErrorReport (): Promise<void> {
  if (context || !hot) {
    return clearChannelReport()
  }
  hot.send(REMOTE_DEV_ERROR_CLEAR_EVENT)
  return Promise.resolve()
}

const reporter = createDevErrorReporter<Request>({
  get cwd () {
    return context!.cwd
  },
  channel: channelPath,
  createReport: error => buildReport(error),
  requestInfo: request => ({ method: request.method, url: new URL(request.url), headers: request.headers }),
  mapStack: error => fixStacktraces(error, context!.server),
})

/** Ask the dev server to build, publish and render the report, as only it can read the sources. */
function requestRemoteReport (error: unknown, request?: Request): Promise<DevErrorReport> {
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const settle = (reply?: RemoteDevErrorReport) => {
      clearTimeout(timer)
      hot!.off(REMOTE_DEV_ERROR_REPORT_EVENT, listener)
      const { report, overlay = '', page = '' } = reply ?? {}
      if (!report) {
        return reject(new Error('The dev server did not report the error.'))
      }
      resolve({
        report,
        overlay: (html) => {
          const index = html.lastIndexOf('</body>')
          return Promise.resolve(index === -1 ? html + overlay : html.slice(0, index) + overlay + html.slice(index))
        },
        page: () => Promise.resolve(page),
      })
    }
    const listener = (reply: RemoteDevErrorReport) => reply.id === id && settle(reply)
    const timer = setTimeout(settle, 10_000)
    hot!.on(REMOTE_DEV_ERROR_REPORT_EVENT, listener)
    hot!.send(REMOTE_DEV_ERROR_EVENT, {
      id,
      error: serializeErrorCause(error),
      status: (error as { status?: number } | undefined)?.status,
      request: request && { method: request.method, url: request.url, headers: [...request.headers] },
    } satisfies RemoteDevError)
  })
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
 * The dev server with only its SSR environment visible, since `viteLoader` maps through
 * the first environment holding the file and an SSR frame belongs to the SSR transform.
 */
function ssrOnly (server: ViteDevServer): ViteDevServer {
  return Object.create(server, { environments: { value: { ssr: server.environments.ssr } } }) as ViteDevServer
}

/**
 * Ask Vite to map the stacks of an error and its causes. It maps in place and appends to
 * `message` on a stack it has already rewritten, so each one is mapped on a carrier.
 */
function fixStacktraces (error: unknown, server: ViteDevServer, seen = new Set<unknown>()): void {
  if (!(error instanceof Error) || seen.has(error)) {
    return
  }
  seen.add(error)
  if (typeof error.stack === 'string') {
    const carrier = { stack: error.stack } as Error
    server.ssrFixStacktrace(carrier)
    if (carrier.stack) {
      try {
        // `stack` can be a getter without a setter
        Object.defineProperty(error, 'stack', { value: carrier.stack, writable: true, configurable: true })
      } catch {
        // non-configurable
      }
    }
  }
  fixStacktraces(error.cause, server, seen)
}

/** The error's `cause` chain, as the error page receives it in the payload. */
export function errorCause (error: unknown): SerializedErrorCause | undefined {
  return serializeErrorCause((error as { cause?: unknown } | undefined)?.cause)
}

function channelPath (): string {
  return env()[ERROR_CHANNEL_ENV] || context!.channel
}
