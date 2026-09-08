import process from 'node:process'
import type { Nuxt } from '@nuxt/schema'
import type { ErrorReport } from 'my-bad'
import type { ViteDevServer, Plugin as VitePlugin } from 'vite'
import { joinURL } from 'ufo'

/** `BroadcastChannel` the process that owns the dev error channel listens on. */
const ERROR_CHANNEL_BROADCAST = 'nuxt:dev:error'

/** Set by a dev server in front of Nuxt when it owns the channel. */
const ERROR_CHANNEL_ENV = 'NUXT_DEV_ERROR_CHANNEL'

/** The shape Vite gives transform failures, to its logger and the HMR channel. */
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
  /** Push overlays to open pages over the HMR channel. */
  attach: (server: ViteDevServer) => void
}

/**
 * Turns the compile errors Vite raises while transforming into reports on the dev
 * error channel, posted over a `BroadcastChannel` to whoever owns it, so error
 * pages and overlays update before anyone requests a page.
 */
export function createDevErrorReporter (nuxt: Nuxt, options: { print: (rendered: string) => void }): DevErrorReporter {
  const broadcast = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
  ;(broadcast as { unref?: () => void }).unref?.()
  nuxt.hook('close', () => broadcast.close())

  let server: ViteDevServer | undefined
  // replayed to each client that connects: an error raised while the page loads
  // predates its hmr connection
  let pendingOverlay: { type: 'custom', event: string, data: unknown } | undefined
  const channelPath = () => process.env[ERROR_CHANNEL_ENV] || joinURL(nuxt.options.app.baseURL, nuxt.options.devServer.errorChannel)
  async function showOverlay (report: ErrorReport, options: { reloadOnClear?: boolean } = {}) {
    const hot = server?.environments.client?.hot
    if (!hot) {
      return
    }
    const [{ renderOverlay }, { nuxtTheme }] = await Promise.all([import('my-bad'), import('my-bad/presets')])
    // the page underneath is the one the developer was looking at
    const html = renderOverlay(report, { cwd: nuxt.options.rootDir, channel: channelPath(), theme: nuxtTheme, tag: 'nuxt-error-overlay', startMinimized: true })
    pendingOverlay = { type: 'custom', event: 'nuxt:dev:error', data: { id: report.id, html, reloadOnClear: options.reloadOnClear } }
    hot.send(pendingOverlay)
  }

  let lastKey: string | undefined
  let current: ErrorReport | undefined
  let file: string | undefined
  let isRuntime = false
  const keyOf = (error: ViteTransformError) => [error.id ?? error.loc?.file, error.loc?.line, error.loc?.column, error.message].join(':')

  broadcast.onmessage = (event) => {
    const message = event.data as { type?: string, report?: ErrorReport }
    switch (message?.type) {
      // a channel that starts listening after the error was reported asks for it
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

  return {
    async report (error) {
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
        showOverlay(report).catch(() => {})
        if (!process.env[ERROR_CHANNEL_ENV]) {
          options.print(renderAnsi(report, { cwd: nuxt.options.rootDir }))
        }
        return report
      } catch {
        // the bundler's logger has been told the error is handled
        options.print(error.stack || error.message)
        return undefined
      }
    },
    clear () {
      if (lastKey === undefined && file === undefined && !isRuntime) {
        return
      }
      lastKey = undefined
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
    attach (devServer) {
      server = devServer
      const hot = devServer.environments.client?.hot
      hot?.on?.('nuxt:dev:client-error', (data: ClientRuntimeError) => {
        reportRuntimeError(data).catch(() => {})
      })
      hot?.on?.('vite:client:connect', () => {
        if (pendingOverlay) {
          hot.send(pendingOverlay)
        }
      })
    },
  }

  /**
   * Build and publish a report for an error the browser raised. Its stack points
   * at the modules Vite served, so URLs are resolved back to files first.
   */
  async function reportRuntimeError (error: ClientRuntimeError): Promise<void> {
    if (!server) {
      return
    }
    const key = `runtime:${error.name}:${error.message}:${error.stack}`
    if (key === lastKey) {
      // the same error again, from a page that reloaded into it
      if (pendingOverlay) {
        server.environments.client?.hot.send(pendingOverlay)
      }
      return
    }
    lastKey = key
    isRuntime = true
    file = undefined
    try {
      const [{ createReport, fsLoader, renderAnsi }, { viteLoader }, { nuxtPreset }] = await Promise.all([import('my-bad'), import('my-bad/vite'), import('my-bad/presets')])
      const input = Object.assign(new Error(error.message), {
        name: error.name || 'Error',
        stack: error.stack && resolveStackUrls(server, error.stack),
      })
      const report = await createReport(input, {
        cwd: nuxt.options.rootDir,
        loaders: [viteLoader(server), fsLoader()],
        presets: [nuxtPreset()],
      })
      current = report
      broadcast.postMessage({ type: 'nuxt:dev:error:report', report })
      // the error left the app half-rendered, so the page starts over
      showOverlay(report, { reloadOnClear: true }).catch(() => {})
      if (!process.env[ERROR_CHANNEL_ENV]) {
        options.print(renderAnsi(report, { cwd: nuxt.options.rootDir }))
      }
    } catch {
      // the browser has no other way of surfacing what it hit
      options.print(error.stack || error.message)
    }
  }

  /** Rewrite the served URLs in a browser stack to the files they were built from. */
  function resolveStackUrls (devServer: ViteDevServer, stack: string): string {
    const graph = devServer.environments.client?.moduleGraph
    if (!graph) {
      return stack
    }
    // graph urls are relative to the bundler's base; the app's base URL sits in
    // front of it in the browser
    const bases = [devServer.config.base, nuxt.options.app.baseURL].map(base => base.replace(/\/$/, '')).filter(Boolean)
    return stack.replace(/https?:\/\/[^\s()]+/g, (match) => {
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
          return `${file}${position}`
        }
      }
      return match
    })
  }
}

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
 * runtime error on any update.
 *
 * Vite transforms on demand and the page showing the error has no HMR client to ask
 * for it, so the failed file is transformed here: once, in the first environment to
 * see the change, and after Vite's own update pass so it cannot race invalidation.
 */
export function DevErrorsPlugin (reporter: DevErrorReporter): VitePlugin {
  let pending: string | undefined
  return {
    name: 'nuxt:dev-errors',
    apply: 'serve',
    configureServer (server) {
      reporter.attach(server)
    },
    hotUpdate ({ file }) {
      // the page reports a runtime error again if the update did not fix it
      if (reporter.isRuntime) {
        reporter.clear()
      }
      if (!reporter.file || file !== reporter.file || pending === file) {
        return
      }
      pending = file
      const environment = this.environment
      setTimeout(() => {
        environment.transformRequest(file).then(
          () => reporter.clear(),
          (error) => {
            if (isTransformError(error)) {
              reporter.report(error).catch(() => {})
            }
          },
        ).finally(() => {
          pending = undefined
        })
      })
    },
  }
}
