import type { BuildProgress, Channel, LogEntry, ProblemMeta } from 'my-bad/channel'
import type { ErrorReport } from 'my-bad'
import type { NuxtOptions } from 'nuxt/schema'

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
  | {
    type: 'nuxt:dev:error:clear'
    id?: string
    /** Retire it only for the page load with this id. */
    requestId?: string
    /** Retire it only for this request, as `METHOD /path`. */
    request?: string
  }
  /** Asks reporters to repeat their current report. */
  | { type: 'nuxt:dev:error:sync' }
  | { type: 'nuxt:dev:error:log', entry: LogEntry }
  | { type: 'nuxt:dev:error:warning', report: ErrorReport }
  | { type: 'nuxt:dev:error:warning:clear', id?: string }
  | { type: 'nuxt:dev:error:progress', progress: BuildProgress }
  /** Replaces the problem set for `source`. */
  | { type: 'nuxt:dev:error:problems', source: string, reports: ErrorReport[], meta?: ProblemMeta }
  /** Clears the problem set for `source`, or every set without one. */
  | { type: 'nuxt:dev:error:problems:clear', source?: string }
  /** Whether a my-bad dock is registered in Vite DevTools. */
  | { type: 'nuxt:dev:error:devtools', registered: boolean }

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

/** What the channel this process owns may open, and which hosts may reach it. */
export interface ErrorChannelAccess {
  /** Directories "open in editor" may open, as Vite's `server.fs.allow`, or `false` for any. */
  root?: string[] | false
  /** Hosts a browser may address the channel through, besides loopback ones. */
  allowedHosts?: string[] | true
}

/**
 * The hosts `devServer.allowedHosts` and `vite.server.allowedHosts` allow, along with `resolved`, the
 * hosts the running Vite server allows once its plugins have configured it.
 */
export function resolveDevAllowedHosts (options: Pick<NuxtOptions, 'devServer' | 'vite'>, resolved?: string[] | true): string[] | true {
  const hosts = [options.devServer.allowedHosts, options.vite?.server?.allowedHosts, resolved]
  return hosts.includes(true) ? true : [...new Set(hosts.flatMap(host => Array.isArray(host) ? host : []))]
}

let channelAccess: ErrorChannelAccess = {}

/** Confine the channel this process owns. Read when the channel is first used. */
export function setErrorChannelAccess (access: ErrorChannelAccess): void {
  channelAccess = access
}

/** The live error channel, forwarding to the dev server in front when there is one. */
export function useErrorChannel (): Promise<Channel> {
  const store = globalThis as { [CHANNEL_KEY]?: Promise<Channel> }
  store[CHANNEL_KEY] ||= isForwarding()
    ? Promise.resolve(createForwardingChannel())
    : import('my-bad/channel').then(({ createChannel }) => createOwnedChannel(createChannel({
        open: true,
        root: channelAccess.root,
        allowedHosts: channelAccess.allowedHosts,
      })))
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

export interface ProblemSetPublisher {
  /** Replace the problem set for `source`. */
  set: (source: string, reports: ErrorReport[], meta?: ProblemMeta) => void
  /** Clear the problem set for `source`. */
  clear: (source: string) => void
  /** Clear every set it published, and publish nothing more. */
  close: () => void
}

/**
 * Publish problem sets to the live channel from any thread. It repeats the latest set of each
 * source when the channel asks, so a channel that restarts gets them back.
 */
export function createProblemSetPublisher (): ProblemSetPublisher {
  const broadcast = openErrorBroadcast()
  const sets = new Map<string, Extract<ErrorChannelMessage, { type: 'nuxt:dev:error:problems' }>>()
  let closed = false
  broadcast.onmessage = (event) => {
    if ((event.data as ErrorChannelMessage | undefined)?.type === 'nuxt:dev:error:sync') {
      for (const message of sets.values()) {
        broadcast.postMessage(message)
      }
    }
  }
  return {
    set (source, reports, meta) {
      if (closed) {
        return
      }
      const message = { type: 'nuxt:dev:error:problems' as const, source, reports, meta }
      sets.set(source, message)
      broadcast.postMessage(message)
    },
    clear (source) {
      if (!closed && sets.delete(source)) {
        broadcast.postMessage({ type: 'nuxt:dev:error:problems:clear', source } satisfies ErrorChannelMessage)
      }
    },
    close () {
      if (closed) {
        return
      }
      closed = true
      for (const source of sets.keys()) {
        broadcast.postMessage({ type: 'nuxt:dev:error:problems:clear', source } satisfies ErrorChannelMessage)
      }
      sets.clear()
      broadcast.close()
    },
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
        return channel.setError(message.report, message.requestId, message.request)
      case 'nuxt:dev:error:clear':
        return channel.clearError(message.id, scopeOf(message))
      case 'nuxt:dev:error:log':
        return channel.log(message.entry)
      case 'nuxt:dev:error:warning':
        return channel.warn(message.report)
      case 'nuxt:dev:error:warning:clear':
        return channel.clearWarning(message.id)
      case 'nuxt:dev:error:progress':
        return channel.progress(message.progress)
      case 'nuxt:dev:error:problems':
        return channel.setProblems(message.source, message.reports, message.meta)
      case 'nuxt:dev:error:problems:clear':
        return channel.clearProblems(message.source)
      case 'nuxt:dev:error:devtools':
        return channel.setDevTools(message.registered)
    }
  }
  post({ type: 'nuxt:dev:error:sync' })
  return {
    ...channel,
    setError (report, requestId?: string, request?: string) {
      channel.setError(report, requestId, request)
      post({ type: 'nuxt:dev:error:report', report, requestId, request })
    },
    clearError (id, request) {
      channel.clearError(id, request)
      post({ type: 'nuxt:dev:error:clear', id, ...request })
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
    clearError (id, request) {
      if (!scopeOf(request ?? {})) {
        current = undefined
      }
      post({ type: 'nuxt:dev:error:clear', id, ...request })
    },
    warn (report) {
      post({ type: 'nuxt:dev:error:warning', report })
    },
    clearWarning (id) {
      post({ type: 'nuxt:dev:error:warning:clear', id })
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
    setDevTools (registered) {
      post({ type: 'nuxt:dev:error:devtools', registered })
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

const PUBLISHED_KEY = Symbol.for('nuxt:dev:error-published')

/** The ids of the reports published for each requested path, by the request (`METHOD /path`) that raised them. */
function publishedByPath (): Map<string, Map<string, Set<string>>> {
  const store = globalThis as { [PUBLISHED_KEY]?: Map<string, Map<string, Set<string>>> }
  return store[PUBLISHED_KEY] ||= new Map()
}

/** The request a clear names, if it names one. */
function scopeOf ({ requestId, request }: { requestId?: string, request?: string }): { requestId?: string, request?: string } | undefined {
  return requestId || request ? { ...requestId && { requestId }, ...request && { request } } : undefined
}

/** Publish a report as an open error, paired with the request it came from. */
export async function publishErrorReport (report: ErrorReport, request?: ErrorRequestInfo): Promise<void> {
  const channel = await useErrorChannel()
  const path = request && `${request.url.pathname}${request.url.search}`
  const scope = path && `${request.method} ${path}`
  channel.setError(report, requestIdOf(request), scope)
  if (scope) {
    const published = publishedByPath()
    const byRequest = published.get(path) ?? new Map<string, Set<string>>()
    published.set(path, byRequest.set(scope, (byRequest.get(scope) ?? new Set()).add(report.id)))
  }
}

/** The id a dev server in front gave the request. */
export function requestIdOf (request?: Pick<ErrorRequestInfo, 'headers'>): string | undefined {
  return request?.headers.get(REQUEST_ID_HEADER) ?? undefined
}

/**
 * Retire the reports published for requests to `url`, which has since rendered. Each stays open
 * for any other request that raised it.
 */
export async function clearErrorReport (url: URL): Promise<void> {
  const path = `${url.pathname}${url.search}`
  const reports = publishedByPath().get(path)
  if (!reports) {
    return
  }
  publishedByPath().delete(path)
  const channel = await useErrorChannel()
  for (const [request, ids] of reports) {
    for (const id of ids) {
      channel.clearError(id, { request })
    }
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
