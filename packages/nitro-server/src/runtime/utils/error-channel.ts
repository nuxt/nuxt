import type { Channel } from 'my-bad/channel'
import type { ErrorReport, SourceLoader } from 'my-bad'
import type { SSRSourceMaps } from '../../augments'
import type { H3Event } from 'nitro/h3'
import { useNitroApp } from 'nitro/app'
import { isMainThread } from 'node:worker_threads'
import process from 'node:process'
import { rootDir } from '#internal/dev-server-logs-options'

import { NUXT_ERROR_CHANNEL } from '#internal/nuxt/nitro-config.mjs'
import { withBaseURL } from './base'

/**
 * Set by a dev server in front of this process when it owns the error channel,
 * to the base path the channel is served at.
 */
export const ERROR_CHANNEL_ENV = 'NUXT_DEV_ERROR_CHANNEL'

/** `BroadcastChannel` reports are forwarded on to the owning dev server. */
export const ERROR_CHANNEL_BROADCAST = 'nuxt:dev:error'

/** Set by the dev server so a report can be paired with its request. */
const REQUEST_ID_HEADER = 'x-nuxt-dev-request-id'

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

/**
 * Whether reports should be forwarded to a dev server that owns the channel
 * rather than served from this process.
 *
 * The dev server announces itself with {@link ERROR_CHANNEL_ENV}. Forwarding
 * only works from a worker thread of that server; runners that cannot reach
 * it keep a channel of their own.
 */
export function shouldForwardReports (env: NodeJS.ProcessEnv = process.env, mainThread: boolean = isMainThread): boolean {
  return !!env[ERROR_CHANNEL_ENV] && !mainThread
}

/** Base path pages should subscribe to, as the dev server in front mounts it. */
export function getErrorChannelPath (): string {
  return process.env[ERROR_CHANNEL_ENV] || withBaseURL(NUXT_ERROR_CHANNEL)
}

/**
 * The live error channel.
 *
 * When a dev server in front of this process owns the channel, this is a
 * forwarding stub that posts reports to it, so that history, sinks and
 * connected pages survive rebuilds of this process. Otherwise the channel is
 * created here on first use.
 *
 * Shared through the global because the renderer and the error handler may be
 * evaluated by different module runners in the same process.
 */
export function useErrorChannel (): Promise<Channel> {
  const store = globalThis as { [CHANNEL_KEY]?: Promise<Channel> }
  store[CHANNEL_KEY] ||= shouldForwardReports()
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
    }
  }
  broadcast.postMessage({ type: 'nuxt:dev:error:sync' } satisfies ErrorChannelMessage)
  return channel
}

const CHANNEL_KEY = Symbol.for('nuxt:dev:error-channel')

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
    warn () {},
    log () {},
    progress () {},
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

/**
 * Publish a report as the current error, paired with the request it came from
 * when the dev server in front identified one.
 */
export async function publishErrorReport (report: ErrorReport, event?: H3Event): Promise<void> {
  const channel = await useErrorChannel()
  const header = event?.req.headers.get(REQUEST_ID_HEADER)
  const requestId = header ? Number(header) : Number.NaN
  const request = event ? `${event.req.method} ${event.url.pathname}${event.url.search}` : undefined
  ;(channel.setError as (report: ErrorReport, requestId?: number, request?: string) => void)(report, Number.isFinite(requestId) ? requestId : undefined, request)
}

/**
 * Build a report for an error raised while rendering.
 *
 * Frames are mapped through the sourcemaps of the SSR bundle where the bundler
 * exposes them, so this must run on the stack as it was raised.
 *
 * @param error - The error to report on.
 * @param event - Request being handled, used for the request and route sections.
 */
export async function createErrorReport (error: unknown, event?: H3Event): Promise<ErrorReport> {
  const [{ createReport, fsLoader, sourceMapLoader }, { nuxtPreset }] = await Promise.all([
    import('my-bad'),
    import('my-bad/presets'),
  ])
  const ssrSourceMaps = useNitroApp().ssrSourceMaps
  return createReport(error, {
    cwd: rootDir,
    loaders: [
      ...ssrSourceMaps
        ? ssrSourceMaps.stacksAreMapped
          ? [compiledPositionLoader(ssrSourceMaps)]
          : ssrSourceMaps.getSourceMap
            ? [sourceMapLoader({ getSourceMap: ssrSourceMaps.getSourceMap, getCode: ssrSourceMaps.getCode })]
            : []
        : [],
      fsLoader(),
    ],
    presets: [nuxtPreset()],
    context: { event },
  })
}

/**
 * Recover the generated position of frames the runner has already mapped, so
 * the report can offer both locations. The frame keeps the source position it
 * arrived with and only gains the position it was compiled from.
 */
function compiledPositionLoader (ssrSourceMaps: SSRSourceMaps): SourceLoader {
  return {
    name: 'nuxt-compiled-position',
    map (frame) {
      if (!frame.file || frame.line === undefined || frame.compiled) {
        return undefined
      }
      const compiled = ssrSourceMaps.getCompiledPosition?.(frame.file, frame.line, frame.column)
      return compiled ? { ...frame, compiled } : undefined
    },
    readCompiled: file => ssrSourceMaps.getCode(file),
  }
}

/** Add the error overlay to an already-rendered page. */
export async function withErrorOverlay (html: string, report: ErrorReport, options: { startMinimized?: boolean } = {}): Promise<string> {
  const [{ injectOverlay }, { nuxtTheme }] = await Promise.all([
    import('my-bad'),
    import('my-bad/presets'),
  ])
  return injectOverlay(html, report, {
    cwd: rootDir,
    channel: getErrorChannelPath(),
    theme: nuxtTheme,
    tag: 'nuxt-error-overlay',
    startMinimized: options.startMinimized,
  })
}

/** Render a standalone error page, for when the app itself cannot render one. */
export async function renderErrorPage (report: ErrorReport): Promise<string> {
  const [{ renderPage }, { nuxtTheme }] = await Promise.all([
    import('my-bad'),
    import('my-bad/presets'),
  ])
  return renderPage(report, {
    cwd: rootDir,
    channel: getErrorChannelPath(),
    theme: nuxtTheme,
  })
}

/**
 * Render a report for the terminal, with the project root shortened to `.`.
 *
 * The rendering carries its own icon and colours, so it should be written as a
 * plain log line rather than at a logger's error level. Causes that only
 * repeat the report's own message are left out.
 */
export async function renderErrorAnsi (report: ErrorReport): Promise<string> {
  const { renderAnsi } = await import('my-bad')
  return renderAnsi(withoutEchoingCauses(report), { cwd: rootDir })
}

function withoutEchoingCauses (report: ErrorReport): ErrorReport {
  const causes = report.causes.filter(cause => cause.message !== report.message).map(withoutEchoingCauses)
  return causes.length === report.causes.length ? report : { ...report, causes }
}
