import process from 'node:process'
import type { Nuxt } from '@nuxt/schema'
import type { ErrorReport } from 'my-bad'
import type { BuildProgress } from 'my-bad/channel'
import type { ViteDevServer, Plugin as VitePlugin } from 'vite'
import { joinURL } from 'ufo'

const ERROR_CHANNEL_BROADCAST = 'nuxt:dev:error'
const ERROR_CHANNEL_ENV = 'NUXT_DEV_ERROR_CHANNEL'

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
  return typeof error === 'object' && error !== null && 'message' in error && ('plugin' in error || 'loc' in error || 'frame' in error)
}

/** An error the browser raised at runtime, as the client plugin serialises it. */
export interface ClientRuntimeError {
  name?: string
  message: string
  stack?: string
  /** Whether the app is left without a page to update, so it reloads once the report clears. */
  fatal?: boolean

}

export interface DevErrorReporter {
  /** Report a transform failure. The same failure is only ever reported once. */
  report: (error: ViteTransformError) => Promise<ErrorReport | undefined>
  /** Clear the current report. */
  clear: () => void
  /** The file whose transform failed, while a report is current. */
  readonly file: string | undefined
  /** Whether the current report came from the browser rather than the bundler. */
  readonly isRuntime: boolean
  /** Show what the bundler is busy with on pages showing a report. */
  progress: (progress: BuildProgress) => void
  /** Push overlays to open pages over the HMR channel. */
  attach: (server: ViteDevServer) => void
}

/** Turns the compile errors Vite raises into reports on the dev error channel. */
export function createDevErrorReporter (nuxt: Nuxt, options: { print: (rendered: string) => void }): DevErrorReporter {
  const broadcast = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
  ;(broadcast as { unref?: () => void }).unref?.()
  nuxt.hook('close', () => broadcast.close())

  let server: ViteDevServer | undefined
  // an error raised while the page loads predates its hmr connection
  let pendingOverlay: { type: 'custom', event: string, data: unknown } | undefined
  const channelPath = () => process.env[ERROR_CHANNEL_ENV] || joinURL(nuxt.options.app.baseURL, nuxt.options.devServer.errorChannel)
  const overlayPath = joinURL(nuxt.options.app.baseURL, `${nuxt.options.devServer.errorChannel}-overlay`)
  function showOverlay (report: ErrorReport, options: { reloadOnClear?: boolean } = {}) {
    const hot = server?.environments.client?.hot
    if (!hot) {
      return
    }
    pendingOverlay = { type: 'custom', event: 'nuxt:dev:error', data: { id: report.id, url: joinURL(overlayPath, report.id), reloadOnClear: options.reloadOnClear } }
    hot.send(pendingOverlay)
  }

  async function renderOverlayFor (report: ErrorReport): Promise<string> {
    const [{ renderOverlay }, { nuxtTheme }] = await Promise.all([import('my-bad'), import('my-bad/presets')])
    return renderOverlay(report, { cwd: nuxt.options.rootDir, channel: channelPath(), theme: nuxtTheme, tag: 'nuxt-error-overlay', startMinimized: true })
  }

  // a page rendered into a report may connect after the update that retired it, and asks
  let clearedAt = 0

  let lastKey: string | undefined
  let current: ErrorReport | undefined
  let file: string | undefined
  let isRuntime = false
  // the same failure reaches the logger and the hot channel worded differently, at one position
  const keyOf = (error: ViteTransformError) => [error.loc?.file ?? error.id, error.loc?.line, error.loc?.column, error.loc ? '' : error.message].join(':')

  broadcast.onmessage = (event) => {
    const message = event.data as { type?: string, report?: ErrorReport }
    switch (message?.type) {
      case 'nuxt:dev:error:sync':
        if (current) {
          broadcast.postMessage({ type: 'nuxt:dev:error:report', report: current })
        }
        return
      // a compile error is remembered by file, so fixing the file clears it;
      // anything else is cleared by the next update
      case 'nuxt:dev:error:report':

        if (message.report && message.report.id !== current?.id) {
          const compiled = compileFile(message.report)
          file = compiled ?? file
          isRuntime ||= !compiled
        }
        return
      case 'nuxt:dev:error:clear':
        if (!current) {
          file = undefined
          isRuntime = false
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
      isRuntime = false
      file = (error.loc?.file ?? error.id)?.split('?')[0]
      try {
        const [{ createReport, renderAnsi }, { nuxtPreset }] = await Promise.all([import('my-bad'), import('my-bad/presets')])
        const report = await createReport(error, { cwd: nuxt.options.rootDir, kind: 'compile', presets: [nuxtPreset()] })
        current = report
        broadcast.postMessage({ type: 'nuxt:dev:error:report', report })
        showOverlay(report)
        if (!process.env[ERROR_CHANNEL_ENV]) {
          options.print(renderAnsi(report, { cwd: nuxt.options.rootDir }))
        }
        return report
      } catch {
        options.print(error.stack || error.message)
        return undefined
      }
    },
    clear () {
      if (lastKey === undefined && file === undefined && !isRuntime) {
        return
      }
      lastKey = undefined
      clearedAt = Date.now()
      current = undefined
      file = undefined
      isRuntime = false
      pendingOverlay = undefined
      broadcast.postMessage({ type: 'nuxt:dev:error:clear' })
      server?.environments.client?.hot.send({ type: 'custom', event: 'nuxt:dev:error:clear' })
    },
    get file () {
      return file
    },
    get isRuntime () {
      return isRuntime
    },
    progress (progress) {
      broadcast.postMessage({ type: 'nuxt:dev:error:progress', progress })
    },
    attach (devServer) {
      server = devServer
      devServer.middlewares.use(overlayPath, (req, res, next) => {
        const id = req.url?.split('?')[0]?.replace(/^\//, '')
        // a report quotes source, so it is only served to the page that was told about it
        const site = req.headers['sec-fetch-site']
        if (!id || !current || current.id !== id || (site !== undefined && site !== 'same-origin')) {
          return next()
        }
        renderOverlayFor(current).then((html) => {
          res.setHeader('content-type', 'text/html;charset=utf-8')
          res.end(html)
        }, next)
      })
      // a hot update that fails to transform is only sent to the client, whose overlay is off
      for (const environment of Object.values(devServer.environments)) {
        const send = environment.hot.send.bind(environment.hot) as (...args: unknown[]) => void
        environment.hot.send = ((...args: unknown[]) => {
          const payload = args[0] as { type?: string, err?: unknown } | string
          if (typeof payload === 'object' && payload.type === 'error' && isTransformError(payload.err)) {
            reporter.report(payload.err).catch(() => {})
          }
          send(...args)
        }) as typeof environment.hot.send
      }
      const hot = devServer.environments.client?.hot
      hot?.on?.('nuxt:dev:client-error', (data: ClientRuntimeError) => {
        reportRuntimeError(data).catch(() => {})
      })
      hot?.on?.('nuxt:dev:error:shown', ({ since }: { since?: number }, client) => {
        if (typeof since === 'number' && since < clearedAt) {
          client.send({ type: 'custom', event: 'nuxt:dev:error:clear' })
        }
      })
      hot?.on?.('vite:client:connect', () => {
        if (pendingOverlay) {
          hot.send(pendingOverlay)
        }
      })
    },
  }
  return reporter

  /** Report an error the browser raised, whose stack points at the modules Vite served. */
  async function reportRuntimeError (error: ClientRuntimeError): Promise<void> {
    if (!server) {
      return
    }
    // a module the browser could not import failed to compile, which is already reported
    if (file
 && !isRuntime && IMPORT_FAILURE_RE.test(error.message)) {
      return
    }
    const key = `runtime:${error.name}:${error.message}:${error.stack}`
    if (key === lastKey) {
      if (pendingOverlay) {
        server.environments.client?.hot.send(pendingOverlay)
      }
      return
    }
    lastKey = key
    isRuntime = true
    file = undefined
    try {
      const [{ createReport, renderAnsi }, { viteLoader }, { nuxtPreset }] = await Promise.all([import('my-bad'), import('my-bad/vite'), import('my-bad/presets')])
      const input = Object.assign(new Error(error.message), {
        name: error.name || 'Error',
        stack: error.stack && resolveStackUrls(server, error.stack),
      })
      const report = await createReport(input, {
        cwd: nuxt.options.rootDir,
        // the stack is client-controlled, so no filesystem loader: only the module graph
        loaders: [viteLoader(server)],
        presets: [nuxtPreset()],
      })
      current = report
      broadcast.postMessage({ type: 'nuxt:dev:error:report', report })
      showOverlay(report, { reloadOnClear: error.fatal !== false })
      if (!process.env[ERROR_CHANNEL_ENV]) {
        options.print(renderAnsi(report, { cwd: nuxt.options.rootDir }))
      }
    } catch {
      options.print(error.stack || error.message)
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
    return error.loc.file && !zeroBased ? error : { ...error, id: error.id ?? file, loc: { ...error.loc, file, column: zeroBased ? error.loc.column + 1 : error.loc.column } }
  }
  if (error.frame || !match) {
    return error
  }
  return { ...error, id: error.id ?? file, loc: { file, line: Number(match[1]), column: Number(match[2]) + 1 } }
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
    configureServer (server) {
      reporter.attach(server)
    },
    hotUpdate ({ file }) {
      if (reporter.isRuntime) {
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
