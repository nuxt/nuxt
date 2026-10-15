import process from 'node:process'
import type { Nuxt } from '@nuxt/schema'
import { ERROR_CHANNEL_ENV, clearErrorReport, createDevErrorReporter, createErrorReport, setErrorChannelForwarding } from 'nuxt/internal/dev-error'
import type { ViteDevServer } from 'vite'

import { REMOTE_DEV_ERROR_CLEAR_EVENT, REMOTE_DEV_ERROR_EVENT, REMOTE_DEV_ERROR_REPORT_EVENT, deserializeError } from './runtime/remote-dev-error.ts'
import type { RemoteDevError, RemoteDevErrorReport } from './runtime/remote-dev-error.ts'

/**
 * Report errors raised by renders a deploy target runs outside this process, whose stacks
 * arrive mapped to source positions.
 */
export function listenForRemoteDevErrors (nuxt: Nuxt, server: ViteDevServer, channel: string): void {
  const forwarding = () => !!process.env[ERROR_CHANNEL_ENV]
  setErrorChannelForwarding(forwarding)
  const channelPath = () => process.env[ERROR_CHANNEL_ENV] || channel

  const observe = createDevErrorReporter<NonNullable<RemoteDevError['request']>>({
    cwd: nuxt.options.rootDir,
    channel: channelPath,
    createReport: (error, request) => createErrorReport(error, { cwd: nuxt.options.rootDir, context: { request } }),
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
    environment.hot.on(REMOTE_DEV_ERROR_CLEAR_EVENT, () => {
      clearErrorReport().catch(() => {})
    })
  }
}
