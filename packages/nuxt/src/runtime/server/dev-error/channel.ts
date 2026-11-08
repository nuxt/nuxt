import type { BuildProgress, Channel, LogEntry, ProblemMeta } from 'my-bad/channel'
import type { ErrorReport } from 'my-bad'

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
  /** Replaces the problem set for `source`. */
  | { type: 'nuxt:dev:error:problems', source: string, reports: ErrorReport[], meta?: ProblemMeta }
  /** Clears the problem set for `source`, or every set without one. */
  | { type: 'nuxt:dev:error:problems:clear', source?: string }

const CHANNEL_KEY = Symbol.for('nuxt:dev:error-channel')

let isForwarding = (): boolean => false

/**
 * Whether reports are forwarded to a dev server in front rather than served from here.
 * Read when the channel is first used, not when this module loads.
 */
export function setErrorChannelForwarding (forward: () => boolean): void {
  isForwarding = forward
}

export function isForwardingReports (): boolean {
  return isForwarding()
}

/** The live error channel, forwarding to the dev server in front when there is one. */
export function useErrorChannel (): Promise<Channel> {
  const store = globalThis as { [CHANNEL_KEY]?: Promise<Channel> }
  store[CHANNEL_KEY] ||= isForwarding()
    ? Promise.resolve(createForwardingChannel())
    : import('my-bad/channel').then(({ createChannel }) => createOwnedChannel(createChannel({ open: true })))
  return store[CHANNEL_KEY]
}

type ErrorBroadcast = Pick<BroadcastChannel, 'onmessage' | 'postMessage' | 'close'>

/** The `BroadcastChannel` reports travel between threads on, which must not hold the process open. It drops every message where none can be opened. */
export function openErrorBroadcast (): ErrorBroadcast {
  try {
    const broadcast = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
    ;(broadcast as { unref?: () => void }).unref?.()
    return broadcast
  } catch {
    return { onmessage: null, postMessage () {}, close () {} }
  }
}

function openBroadcast (): { broadcast: ErrorBroadcast, post: (message: ErrorChannelMessage) => void } {
  const broadcast = openErrorBroadcast()
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
      case 'nuxt:dev:error:problems':
        return channel.setProblems(message.source, message.reports, message.meta)
      case 'nuxt:dev:error:problems:clear':
        return channel.clearProblems(message.source)
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
    get problems () {
      return channel.problems
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
    setProblems (source, reports, meta) {
      post({ type: 'nuxt:dev:error:problems', source, reports, meta })
    },
    clearProblems (source) {
      post({ type: 'nuxt:dev:error:problems:clear', source })
    },
    get current () {
      return current
    },
    history: [],
    historyFor: () => [],
    problems: [],
    subscribe: () => () => {},
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
