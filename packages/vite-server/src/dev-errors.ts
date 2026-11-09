import type { IncomingMessage, ServerResponse } from 'node:http'
import process from 'node:process'
import type { Nuxt } from '@nuxt/schema'
import { ERROR_CHANNEL_ENV, clearErrorReport, createDevErrorReporter, createErrorReport, renderDevBadge, resolveDevAllowedHosts, setErrorChannelAccess, setErrorChannelForwarding, useErrorChannel } from 'nuxt/internal/dev-error'
import type { ErrorChannelAccess } from 'nuxt/internal/dev-error'
import { isFileLoadingAllowed } from 'vite'
import type { ViteDevServer } from 'vite'

import { REMOTE_DEV_ERROR_CLEAR_EVENT, REMOTE_DEV_ERROR_EVENT, REMOTE_DEV_ERROR_REPORT_EVENT, deserializeError } from './runtime/remote-dev-error.ts'
import type { RemoteDevError, RemoteDevErrorReport } from './runtime/remote-dev-error.ts'

/** Whether a report may quote a file from disk, as the dev server would load it. */
export function reportFileAccess (server: ViteDevServer): (file: string) => boolean {
  return file => isFileLoadingAllowed(server.config, file)
}

/** What the channel may open, as the dev server would load it, and the hosts it may be reached through. */
export function errorChannelAccess (nuxt: Nuxt, server: ViteDevServer): ErrorChannelAccess {
  const { allow, strict } = server.config.server.fs
  return {
    root: strict === false ? false : allow,
    allowedHosts: resolveDevAllowedHosts(nuxt.options, server.config.server.allowedHosts),
  }
}

/**
 * Serve the live error channel from this process, for an app with no server entry to serve
 * it, unless a dev server in front owns it. Resolves whether the request was the channel's.
 */
export function serveErrorChannel (nuxt: Nuxt, server: ViteDevServer, channel: string): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const forwarding = () => !!process.env[ERROR_CHANNEL_ENV]
  setErrorChannelForwarding(forwarding)
  setErrorChannelAccess(errorChannelAccess(nuxt, server))
  // opened eagerly so it is listening for the bundler's reports
  useErrorChannel().catch(() => {})
  const base = channel.replace(/\/$/, '')
  return async (req, res) => {
    const pathname = (req.url || '/').split('?')[0]!
    if (forwarding() || (pathname !== base && !pathname.startsWith(`${base}/`))) {
      return false
    }
    return (await useErrorChannel()).handler(req, res)
  }
}

/** Add the badge to the head of a document served without a render. */
export async function withDevBadge (nuxt: Nuxt, html: string, channel: string, request: Request): Promise<string> {
  if (nuxt.options.test) {
    return html
  }
  const badge = await renderDevBadge({ cwd: nuxt.options.rootDir, channel: process.env[ERROR_CHANNEL_ENV] || channel, request }).catch(() => '')
  const index = html.indexOf('</head>')
  return index === -1 ? badge + html : html.slice(0, index) + badge + html.slice(index)
}

/**
 * Report errors raised by renders a deploy target runs outside this process, whose stacks
 * arrive mapped to source positions.
 */
export function listenForRemoteDevErrors (nuxt: Nuxt, server: ViteDevServer, channel: string): void {
  const forwarding = () => !!process.env[ERROR_CHANNEL_ENV]
  setErrorChannelForwarding(forwarding)
  setErrorChannelAccess(errorChannelAccess(nuxt, server))
  const channelPath = () => process.env[ERROR_CHANNEL_ENV] || channel

  const observe = createDevErrorReporter<NonNullable<RemoteDevError['request']>>({
    cwd: nuxt.options.rootDir,
    channel: channelPath,
    createReport: (error, request) => createErrorReport(error, { cwd: nuxt.options.rootDir, canRead: reportFileAccess(server), context: { request } }),
    requestInfo: request => ({ method: request.method, url: new URL(request.url), headers: new Headers(request.headers) }),
  })

  for (const environment of Object.values(server.environments)) {
    // the client's channel is driven by the browser, which must not name files to read
    if (environment.config.consumer !== 'server') {
      continue
    }
    environment.hot.on(REMOTE_DEV_ERROR_EVENT, async (message: RemoteDevError, client) => {
      const error = deserializeError(message.error)
      if (error instanceof Error && message.status !== undefined) {
        Object.assign(error, { status: message.status })
      }
      const result = await observe(error, message.request).catch(() => undefined)
      const [overlay, page] = result ? await Promise.all([result.overlay(''), result.page()]).catch(() => []) : []
      client.send(REMOTE_DEV_ERROR_REPORT_EVENT, { id: message.id, report: result?.report, overlay, page } satisfies RemoteDevErrorReport)
    })
    environment.hot.on(REMOTE_DEV_ERROR_CLEAR_EVENT, ({ url }: { url: string }) => {
      clearErrorReport(new URL(url)).catch(() => {})
    })
  }
}
