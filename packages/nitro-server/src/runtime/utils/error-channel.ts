import type { Channel } from 'my-bad/channel'
import type { ErrorReport, SourceLoader } from 'my-bad'
import type { SSRSourceMaps } from '../../augments'
import type { H3Event } from 'nitro/h3'
import { useNitroApp } from 'nitro/app'
import { isMainThread } from 'node:worker_threads'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { rootDir, srcDir } from '#internal/dev-server-logs-options'
import * as devError from 'nuxt/internal/dev-error'

import { NUXT_ERROR_CHANNEL } from '#internal/nuxt/nitro-config.mjs'
import { withBaseURL } from './base'

export const ERROR_CHANNEL_ENV = devError.ERROR_CHANNEL_ENV
export const ERROR_CHANNEL_BROADCAST = devError.ERROR_CHANNEL_BROADCAST

export { clearErrorReport, publishDevLog, publishDevProgress, serializeErrorCause } from 'nuxt/internal/dev-error'
export type { ErrorChannelMessage } from 'nuxt/internal/dev-error'

/**
 * Whether reports should be forwarded to the dev server that announced itself with
 * {@link ERROR_CHANNEL_ENV}, which is only reachable from a worker thread of it.
 */
export function shouldForwardReports (env: NodeJS.ProcessEnv = process.env, mainThread: boolean = isMainThread): boolean {
  return !!env[ERROR_CHANNEL_ENV] && !mainThread
}

/** Base path pages should subscribe to, as the dev server in front mounts it. */
export function getErrorChannelPath (): string {
  return process.env[ERROR_CHANNEL_ENV] || withBaseURL(NUXT_ERROR_CHANNEL)
}

devError.configureErrorChannel({ forward: () => shouldForwardReports() })

/** The live error channel, forwarding to the dev server in front when there is one. */
export function useErrorChannel (): Promise<Channel> {
  return devError.useErrorChannel()
}

/** Publish a report as the current error, paired with the request it came from. */
export function publishErrorReport (report: ErrorReport, event?: H3Event): Promise<void> {
  return devError.publishErrorReport(report, event && { method: event.req.method, url: event.url, headers: event.req.headers })
}

/**
 * Build a report for an error raised while rendering. Frames are mapped through the SSR
 * bundle's sourcemaps, so this must run on the stack as it was raised.
 */
export function createErrorReport (error: unknown, event?: H3Event): Promise<ErrorReport> {
  devError.resolveErrorPaths(error, resolveTransformPath)
  const ssrSourceMaps = useNitroApp().ssrSourceMaps
  return devError.createErrorReport(error, {
    cwd: rootDir,
    loaders: ssrSourceMaps ? [compiledPositionLoader(ssrSourceMaps)] : [],
    context: { event },
  })
}

/**
 * A module that failed to transform is named by its bundler id, such as `/app.vue`, which
 * reads as an absolute path but is relative to the environment root. Resolve those to a
 * file the developer can open.
 */
function resolveTransformPath (path: string): string {
  const query = path.indexOf('?')
  const file = query === -1 ? path : path.slice(0, query)
  if (!file.startsWith('/') || existsSync(file)) {
    return path
  }
  // the SSR environment is rooted at `srcDir`, and virtual ids can be root-relative
  for (const root of [srcDir, rootDir]) {
    const resolved = join(root, file)
    if (existsSync(resolved)) {
      return query === -1 ? resolved : resolved + path.slice(query)
    }
  }
  return path
}

/** Recover the generated position of frames the runner has already mapped. */
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
export function withErrorOverlay (html: string, report: ErrorReport, options: { startMinimized?: boolean } = {}): Promise<string> {
  return devError.withErrorOverlay(html, report, { cwd: rootDir, channel: getErrorChannelPath(), startMinimized: options.startMinimized })
}

/** Render a standalone error page, for when the app itself cannot render one. */
export function renderErrorPage (report: ErrorReport): Promise<string> {
  return devError.renderErrorPage(report, { cwd: rootDir, channel: getErrorChannelPath() })
}

/** Render a report for the terminal. It carries its own icon and colours, so log it plainly. */
export function renderErrorAnsi (report: ErrorReport): Promise<string> {
  return devError.renderErrorAnsi(report, { cwd: rootDir })
}
