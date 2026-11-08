import process from 'node:process'
import type { Nuxt } from '@nuxt/schema'
import type { ErrorReport } from 'my-bad'
import type { BuildProgress, ProblemMeta } from 'my-bad/channel'
import { isFileLoadingAllowed } from 'vite'
import type { ServerResponse } from 'node:http'
import type { Connect, ViteDevServer, Plugin as VitePlugin } from 'vite'
import { joinURL } from 'ufo'
import { ERROR_CHANNEL_ENV, REQUEST_ID_HEADER, createReportFsLoader, openErrorBroadcast, stripControlCharacters } from 'nuxt/internal/dev-error'
import type { ErrorChannelMessage } from 'nuxt/internal/dev-error'

/** The shape Vite gives transform failures. */
export interface ViteTransformError {
  message: string
  stack?: string
  id?: string
  plugin?: string
  pluginCode?: string
  frame?: string
  loc?: { file?: string, line: number, column: number }
}

export function isTransformError (error: unknown): error is ViteTransformError {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false
  }
  // vite sends every error its middleware catches with these fields, unset unless a transform failed
  const { plugin, loc, frame } = error as Partial<ViteTransformError>
  return !!(plugin || loc || frame)
}

/** An error the browser raised at runtime, as the client plugin serialises it. */
export interface ClientRuntimeError {
  name?: string
  message: string
  stack?: string
  /** The page load that raised it, which the report is shown to. */
  requestId?: string
}

export interface DevErrorReporter {
  /** Report a transform failure. The same failure is only ever reported once. */
  report: (error: ViteTransformError) => Promise<ErrorReport | undefined>
  /** Clear the current report. */
  clear: () => void
  /** The file whose transform failed, while a report is current. */
  readonly file: string | undefined
  /** Whether a report from the browser, rather than the bundler, is open. */
  readonly isRuntime: boolean
  /** Show what the bundler is busy with on pages showing a report. */
  progress: (progress: BuildProgress) => void
  /** Report the errors open pages raise, and the compile errors Vite only sends to them. */
  attach: (server: ViteDevServer) => void
  /** Replace the problem set for `source`. */
  setProblems: (source: string, reports: ErrorReport[], meta?: ProblemMeta) => void
  /** Clear the problem set for `source`. */
  clearProblems: (source: string) => void
  /** Tell the channel a my-bad dock is registered in Vite DevTools. */
  registerDevTools: () => void
  /** Report an error a dev server middleware raised serving `request`, as `METHOD /path`. */
  reportRequestError: (error: unknown, request: string, requestId?: string) => Promise<void>
  /** Whether `request` raised an error that is still open. */
  hasRequestError: (request: string) => boolean
  /** Retire the error `request` raised, which has since been served. */
  requestServed: (request: string) => void
}

/** Where a producer publishes its problem sets. */
export type ProblemSink = Pick<DevErrorReporter, 'setProblems' | 'clearProblems'>

/** Turns the compile errors Vite raises into reports on the dev error channel. */
export function createDevErrorReporter (nuxt: Nuxt, options: { print: (rendered: string) => void }): DevErrorReporter {
  const broadcast = openErrorBroadcast()
  let server: ViteDevServer | undefined

  let lastKey: string | undefined
  let current: ErrorReport | undefined
  let file: string | undefined
  // the browser error each page load is reporting, by request id, and the last one published for it
  const browserReports = new Map<string, { key: string, report?: ErrorReport }>()
  // the error each request a dev server middleware failed is reporting, by `METHOD /path`, and the last one published for it
  const requestReports = new Map<string, { key: string, report?: ErrorReport }>()
  // another process published an error that no file compiling again retires
  let publishedRuntime = false
  // the file of a compile report another process published, which vite's hmr payload would replace without its name
  let publishedFile: string | undefined
  // the reports another process published that are still open
  const published = new Set<string>()
  const problems = new Map<string, ErrorChannelMessage & { type: 'nuxt:dev:error:problems' }>()
  let devtools = false
  let closed = false
  // a rebuild or report still pending when Nuxt closes would post to a closed channel
  const post = (message: ErrorChannelMessage) => closed || broadcast.postMessage(message)
  // the channel can outlive this instance, and this runs before the dev server closes
  nuxt.hook('close', () => {
    closed = true
    for (const source of problems.keys()) {
      broadcast.postMessage({ type: 'nuxt:dev:error:problems:clear', source } satisfies ErrorChannelMessage)
    }
    problems.clear()
    if (devtools) {
      broadcast.postMessage({ type: 'nuxt:dev:error:devtools', registered: false } satisfies ErrorChannelMessage)
    }
    broadcast.close()
  })
  // the same failure reaches the logger and the hot channel worded differently, at one position
  const keyOf = (error: ViteTransformError) => [error.loc?.file ?? error.id, error.loc?.line, error.loc?.column, error.loc ? '' : error.message].join(':')

  broadcast.onmessage = (event) => {
    const message = event.data as { type?: string, report?: ErrorReport, id?: string, requestId?: string, request?: string }
    switch (message?.type) {
      case 'nuxt:dev:error:sync':
        if (current) {
          broadcast.postMessage({ type: 'nuxt:dev:error:report', report: current })
        }
        for (const [requestId, { report }] of browserReports) {
          if (report) {
            broadcast.postMessage({ type: 'nuxt:dev:error:report', report, requestId: requestId || undefined } satisfies ErrorChannelMessage)
          }
        }
        for (const [request, { report }] of requestReports) {
          if (report) {
            broadcast.postMessage({ type: 'nuxt:dev:error:report', report, request } satisfies ErrorChannelMessage)
          }
        }
        for (const message of problems.values()) {
          broadcast.postMessage(message)
        }
        if (devtools) {
          broadcast.postMessage({ type: 'nuxt:dev:error:devtools', registered: true } satisfies ErrorChannelMessage)
        }
        return
      // a compile error is remembered by file, so fixing the file clears it;
      // anything else is cleared by the next update
      case 'nuxt:dev:error:report':

        if (message.report && message.report.id !== current?.id) {
          published.add(message.report.id)
          const compiled = compileFile(message.report)
          file = compiled ?? file
          publishedRuntime ||= !compiled
          publishedFile = compiled
          // an error from no request replaces every open error
          if (!message.requestId && !message.request) {
            browserReports.clear()
            requestReports.clear()
          }
        }
        return
      case 'nuxt:dev:error:clear':
        if (message.id) {
          published.delete(message.id)
        } else {
          published.clear()
        }
        if (published.size) {
          return
        }
        publishedFile = undefined
        if (!current) {
          file = undefined
          publishedRuntime = false
        }
    }
  }

  const reporter: DevErrorReporter = {
    async report (raw) {
      const error = withMessageLocation(raw)
      const key = keyOf(error)
      if (key === lastKey) {
        return
      }
      lastKey = key
      publishedRuntime = false
      // a compile error is published from no request, so it replaces the errors pages raised
      browserReports.clear()
      requestReports.clear()
      publishedFile = undefined
      file = (error.loc?.file ?? error.id)?.split('?')[0]
      try {
        const config = server?.config
        const [{ createReport, renderAnsi }, { nuxtPreset }, fs] = await Promise.all([
          import('my-bad'),
          import('my-bad/presets'),
          createReportFsLoader({ cwd: nuxt.options.rootDir, canRead: config && (file => isFileLoadingAllowed(config, file)) }),
        ])
        const report = await createReport(error, { cwd: nuxt.options.rootDir, kind: 'compile', loaders: [fs], presets: [nuxtPreset()] })
        // cleared or replaced while it was being built
        if (lastKey !== key) {
          return undefined
        }
        current = report
        post({ type: 'nuxt:dev:error:report', report })
        if (!process.env[ERROR_CHANNEL_ENV]) {
          options.print(renderAnsi(report, { cwd: nuxt.options.rootDir }))
        }
        return report
      } catch {
        options.print(stripControlCharacters(String(error.stack || error.message)))
        return undefined
      }
    },
    clear () {
      if (lastKey === undefined && file === undefined && !reporter.isRuntime) {
        return
      }
      lastKey = undefined
      publishedFile = undefined
      published.clear()
      current = undefined
      file = undefined
      publishedRuntime = false
      browserReports.clear()
      requestReports.clear()
      post({ type: 'nuxt:dev:error:clear' })
    },
    get file () {
      return file
    },
    get isRuntime () {
      return publishedRuntime || browserReports.size > 0 || requestReports.size > 0
    },
    progress (progress) {
      post({ type: 'nuxt:dev:error:progress', progress })
    },
    setProblems (source, reports, meta) {
      if (closed) {
        return
      }
      const message = { type: 'nuxt:dev:error:problems' as const, source, reports, meta }
      problems.set(source, message)
      broadcast.postMessage(message)
    },
    clearProblems (source) {
      if (problems.delete(source)) {
        broadcast.postMessage({ type: 'nuxt:dev:error:problems:clear', source } satisfies ErrorChannelMessage)
      }
    },
    registerDevTools () {
      if (closed || devtools) {
        return
      }
      devtools = true
      broadcast.postMessage({ type: 'nuxt:dev:error:devtools', registered: true } satisfies ErrorChannelMessage)
    },
    async reportRequestError (error, request, requestId) {
      if (!server || isTransformError(error) || !(error instanceof Error)) {
        return
      }
      const key = `${error.name}:${error.message}:${error.stack}`
      if (requestReports.get(request)?.key === key) {
        return
      }
      const pending: { key: string, report?: ErrorReport } = { key, report: requestReports.get(request)?.report }
      requestReports.set(request, pending)
      try {
        const config = server.config
        const [{ createReport }, { nuxtPreset }, fs] = await Promise.all([
          import('my-bad'),
          import('my-bad/presets'),
          createReportFsLoader({ cwd: nuxt.options.rootDir, canRead: file => isFileLoadingAllowed(config, file) }),
        ])
        const report = await createReport(error, { cwd: nuxt.options.rootDir, kind: 'error', loaders: [fs], presets: [nuxtPreset()] })
        if (requestReports.get(request) !== pending) {
          return
        }
        pending.report = report
        post({ type: 'nuxt:dev:error:report', report, request, ...requestId && { requestId } })
      } catch {
        // vite has already logged the error
      }
    },
    hasRequestError (request) {
      return requestReports.has(request)
    },
    requestServed (request) {
      const reported = requestReports.get(request)
      if (!reported) {
        return
      }
      requestReports.delete(request)
      if (reported.report) {
        post({ type: 'nuxt:dev:error:clear', id: reported.report.id })
      }
    },
    attach (devServer) {
      server = devServer
      // a hot update that fails to transform is only sent to the client, whose overlay is off
      for (const environment of Object.values(devServer.environments)) {
        const send = environment.hot.send.bind(environment.hot) as (...args: unknown[]) => void
        environment.hot.send = ((...args: unknown[]) => {
          const payload = args[0] as { type?: string, err?: unknown } | string
          if (typeof payload === 'object' && payload.type === 'error' && isTransformError(payload.err) && !isPublished(payload.err)) {
            reporter.report(payload.err).catch(() => {})
          }
          send(...args)
        }) as typeof environment.hot.send
      }
      const hot = devServer.environments.client?.hot
      hot?.on?.('nuxt:dev:client-error', (data: unknown) => {
        const error = toClientRuntimeError(data)
        if (error) {
          reportRuntimeError(error).catch(() => {})
        }
      })
      hot?.on?.('nuxt:dev:client-error:clear', (data: unknown) => {
        const requestId = (data as { requestId?: unknown } | null)?.requestId
        const slot = typeof requestId === 'string' ? requestId : ''
        const reported = browserReports.get(slot)
        if (!reported) {
          return
        }
        browserReports.delete(slot)
        if (reported.report) {
          post({ type: 'nuxt:dev:error:clear', id: reported.report.id })
        }
      })
    },
  }
  return reporter

  function isPublished (error: ViteTransformError): boolean {
    return !!publishedFile && withMessageLocation(error).loc?.file?.split('?')[0] === publishedFile
  }

  /** Report an error the browser raised, whose stack points at the modules Vite served. */
  async function reportRuntimeError (error: ClientRuntimeError): Promise<void> {
    if (!server) {
      return
    }
    // a module the browser could not import failed to compile, which is already reported
    if (file && IMPORT_FAILURE_RE.test(error.message)) {
      return
    }
    const stack = error.stack && resolveStackUrls(server, error.stack)
    // raised by code the dev server never served, such as DevTools or a browser extension
    if (server.environments.client?.moduleGraph && error.stack && hasLocatedFrame(error.stack) && !hasLocatedFrame(stack!)) {
      return
    }
    // a runtime report belongs to the page load that raised it
    const slot = error.requestId ?? ''
    const key = `${error.name}:${error.message}:${error.stack}`
    if (browserReports.get(slot)?.key === key) {
      return
    }
    const pending: { key: string, report?: ErrorReport } = { key, report: browserReports.get(slot)?.report }
    browserReports.set(slot, pending)
    try {
      const [{ createReport, renderAnsi }, { viteLoader }, { nuxtPreset }] = await Promise.all([import('my-bad'), import('my-bad/vite'), import('my-bad/presets')])
      const input = Object.assign(new Error(error.message), {
        name: error.name || 'Error',
        stack,
      })
      const report = await createReport(input, {
        cwd: nuxt.options.rootDir,
        // the message and stack are client-controlled: no compile detection, no filesystem reads, only the module graph
        kind: 'error',
        loaders: [viteLoader(server, { fs: false })],
        presets: [nuxtPreset()],
      })
      // the page recovered, raised another error, or was replaced while this was being built
      if (browserReports.get(slot) !== pending) {
        return
      }
      pending.report = report
      post({ type: 'nuxt:dev:error:report', report, requestId: error.requestId })
      if (!process.env[ERROR_CHANNEL_ENV]) {
        options.print(renderAnsi(report, { cwd: nuxt.options.rootDir }))
      }
    } catch {
      options.print(stripControlCharacters(error.stack || error.message))
    }
  }

  /**
   * Rewrite the served URLs in a browser stack to the files they were built from, dropping
   * frames naming anything the browser was never served.
   */
  function resolveStackUrls (devServer: ViteDevServer, stack: string): string {
    const graph = devServer.environments.client?.moduleGraph
    if (!graph) {
      return stack.split('\n').filter((line, index) => index === 0 || !FRAME_LOCATION_RE.test(line)).join('\n')
    }
    // graph urls are relative to the bundler's base, which the app's base URL precedes
    const bases = [devServer.config.base, nuxt.options.app.baseURL].map(base => base.replace(/\/$/, '')).filter(Boolean)
    const graphFiles = new Set<string>()
    const [message, ...frames] = stack.split('\n')
    const resolved = frames.map(line => line.replace(SERVED_URL_RE, match => resolveServedUrl(match) ?? match))
    return [message, ...resolved.filter(line => !FRAME_LOCATION_RE.test(line) || graphFiles.has(fileOf(line)!))].join('\n')

    function resolveServedUrl (match: string): string | undefined {
      const position = /:\d+:\d+$/.exec(match)?.[0] ?? ''
      let url: string
      try {
        const parsed = new URL(match.slice(0, match.length - position.length))
        url = `${parsed.pathname}${parsed.search}`
      } catch {
        return match
      }
      const candidates = new Set<string>()
      for (const path of [url, ...bases.map(base => url.startsWith(`${base}/`) ? url.slice(base.length) : undefined)]) {
        if (path) {
          candidates.add(path)
          candidates.add(path.split('?')[0]!)
        }
      }
      for (const candidate of candidates) {
        const mod = graph.urlToModuleMap.get(candidate) ?? graph.getModuleById(candidate)
        const file = mod?.file ?? mod?.id
        if (file) {
          graphFiles.add(file.split('?')[0]!)
          return `${file}${position}`
        }
      }
      return undefined
    }
  }
}

/** The fields of a browser runtime error that have the expected types, as sent over the HMR channel. */
function toClientRuntimeError (data: unknown): ClientRuntimeError | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined
  }
  const { name, message, stack, requestId } = data as Record<string, unknown>
  if (typeof message !== 'string') {
    return undefined
  }
  return {
    message,
    ...typeof name === 'string' && { name },
    ...typeof stack === 'string' && { stack },
    ...typeof requestId === 'string' && { requestId },
  }
}

function hasLocatedFrame (stack: string): boolean {
  return stack.split('\n').some(line => FRAME_LOCATION_RE.test(line))
}

/** The file of a frame, if it names one. */
function fileOf (line: string): string | undefined {
  const match = FRAME_LOCATION_RE.exec(line)
  return (match?.[1] ?? match?.[2])?.split('?')[0]
}

/** `Unexpected token (2:9)`, as a parser positions an error within a file. */
const MESSAGE_LOCATION_RE = /\((\d+):(\d+)\)(?=\s|$)/

/** A file named on a line of its own, as a compiler quotes the file it failed on. */
const MESSAGE_FILE_RE = /^(\S+\.(?:vue|[cm]?[jt]sx?))$/m

/** A transform error with the location a renderer reads, recovered from its message. */
function withMessageLocation (error: ViteTransformError): ViteTransformError {
  const [first = '', ...rest] = error.message.split('\n')
  const match = MESSAGE_LOCATION_RE.exec(first)
  const file = error.loc?.file ?? error.id?.split('?')[0] ?? MESSAGE_FILE_RE.exec(rest.join('\n'))?.[1]
  if (!file) {
    return error
  }
  if (error.loc) {
    // a parser counts columns from 0 in its message, and so in the position it attaches
    const zeroBased = match && Number(match[1]) === error.loc.line && Number(match[2]) === error.loc.column
    return error.loc.file && !zeroBased ? error : relocated(error, { id: error.id ?? file, loc: { ...error.loc, file, column: zeroBased ? error.loc.column + 1 : error.loc.column } })
  }
  if (error.frame || !match) {
    return error
  }
  return relocated(error, { id: error.id ?? file, loc: { file, line: Number(match[1]), column: Number(match[2]) + 1 } })
}

/** A copy of `error` at `location`, keeping the properties an `Error` does not enumerate. */
function relocated (error: ViteTransformError, location: Pick<ViteTransformError, 'id' | 'loc'>): ViteTransformError {
  const { name, stack, cause } = error as Partial<Error>
  return { ...name !== undefined && { name }, ...stack !== undefined && { stack }, ...cause !== undefined && { cause }, ...error, ...location, message: error.message }
}

/** What browsers say when a served module responds with an error. */
const IMPORT_FAILURE_RE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/

/** `at fn (/path/to/file.ts:1:2)` or `at /path/to/file.ts:1:2`, as V8 writes a located frame. */
const FRAME_LOCATION_RE = /^\s*at (?:[^(]*\((.+)|(.+)):\d+:\d+\)?\s*$/
const SERVED_URL_RE = /https?:\/\/[^\s()]+/g

function compileFile (report: ErrorReport): string | undefined {
  if (report.kind === 'compile' && report.frames[0]?.file) {
    return report.frames[0].file
  }
  for (const cause of report.causes) {
    const file = compileFile(cause)
    if (file) {
      return file
    }
  }
}

/** Adds the dev error channel's dock to Vite DevTools, when it is installed. */
export async function DevErrorsDevToolsPlugin (nuxt: Nuxt, reporter: DevErrorReporter): Promise<VitePlugin> {
  const { myBadDevTools } = await import('my-bad/vite')
  return myBadDevTools({
    channel: process.env[ERROR_CHANNEL_ENV] || joinURL(nuxt.options.app.baseURL, nuxt.options.devServer.errorChannel),
    title: 'Problems',
    onRegister: () => reporter.registerDevTools(),
  })
}

/**
 * Reports the errors dev server middlewares raise serving a request, which Vite only logs.
 * Its middleware runs after every other plugin's, ahead of Vite's own error handler.
 */
export function DevRequestErrorsPlugin (reporter: DevErrorReporter): VitePlugin {
  return {
    name: 'nuxt:dev-request-errors',
    apply: 'serve',
    configureServer: {
      order: 'post',
      handler (server) {
        return () => {
          server.middlewares.use(function nuxtDevRequestErrors (error: unknown, req: Connect.IncomingMessage, _res: ServerResponse, next: Connect.NextFunction) {
            const requestId = req.headers[REQUEST_ID_HEADER]
            reporter.reportRequestError(error, requestOf(req), typeof requestId === 'string' ? requestId : undefined).catch(() => {})
            next(error)
          })
        }
      },
    },
  }
}

function requestOf (req: Connect.IncomingMessage): string {
  return `${req.method} ${req.originalUrl || req.url || '/'}`
}

/**
 * Clears the report once the file that failed compiles again, and clears a browser
 * runtime error on any update. Vite transforms on demand and the page showing the error
 * has no HMR client to ask for it, so the failed file is transformed here.
 */
export function DevErrorsPlugin (reporter: DevErrorReporter): VitePlugin {
  let pending: string | undefined
  return {
    name: 'nuxt:dev-errors',
    apply: 'serve',
    configResolved (config) {
      // runtime errors reach the terminal through the reporter, mapped and framed
      config.server.forwardConsole.unhandledErrors = false
    },
    configureServer: {
      order: 'pre',
      handler (server) {
        reporter.attach(server)
        server.middlewares.use(function nuxtDevErrorsServed (req, res, next) {
          const request = requestOf(req)
          if (reporter.hasRequestError(request)) {
            res.once('finish', () => res.statusCode < 500 && reporter.requestServed(request))
          }
          next()
        })
      },
    },
    hotUpdate ({ file }) {
      // a file that still fails to compile keeps its report until it compiles, which clears everything
      if (reporter.isRuntime && !reporter.file) {
        reporter.clear()
      }
      if (!reporter.file || file !== reporter.file || pending === file) {
        return
      }
      pending = file
      const environment = this.environment
      setTimeout(() => {
        reporter.progress({ phase: 'transform', message: 'Rebuilding' })
        environment.transformRequest(file).then(
          () => reporter.clear(),
          (error) => {
            if (isTransformError(error)) {
              reporter.report(error).catch(() => {})
            }
          },
        ).finally(() => {
          reporter.progress({ phase: 'transform', percent: 100 })
          pending = undefined
        })
      })
    },
  }
}
