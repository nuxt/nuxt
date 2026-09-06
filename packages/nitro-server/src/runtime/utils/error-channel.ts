import type { Channel } from 'my-bad/channel'
import type { ErrorReport, SourceLoader } from 'my-bad'
import type { SSRSourceMaps } from '../../augments'
import type { H3Event } from 'nitro/h3'
import { useNitroApp } from 'nitro/app'
import { isMainThread } from 'node:worker_threads'
import process from 'node:process'
import { rootDir } from '#internal/dev-server-logs-options'
import * as devError from 'nuxt/internal/dev-error'

import { NUXT_ERROR_CHANNEL } from '#internal/nuxt/nitro-config.mjs'
import { withBaseURL } from './base'

export const ERROR_CHANNEL_ENV = devError.ERROR_CHANNEL_ENV
export const ERROR_CHANNEL_BROADCAST = devError.ERROR_CHANNEL_BROADCAST

export { clearErrorReport, serializeErrorCause } from 'nuxt/internal/dev-error'
export type { ErrorChannelMessage } from 'nuxt/internal/dev-error'

/**
 * Whether reports should be forwarded to the dev server that announced itself with
 * {@link ERROR_CHANNEL_ENV}. Only reachable from a worker thread of that server, so a
 * runner anywhere else keeps a channel of its own.
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

/**
 * Rewrite stack positions from SSR-transformed positions to source positions, before
 * anything reads the error, so every consumer agrees on them.
 */
export function mapSSRStacktrace (error: unknown): void {
  const fixStacktrace = useNitroApp().ssrSourceMaps?.fixStacktrace
  if (fixStacktrace) {
    devError.mapErrorStacktrace(error, fixStacktrace)
  }
}

/**
 * Publish a report as the current error, paired with the request it came from
 * when the dev server in front identified one.
 */
export function publishErrorReport (report: ErrorReport, event?: H3Event): Promise<void> {
  return devError.publishErrorReport(report, event && { method: event.req.method, url: event.url, headers: event.req.headers })
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
  const ssrSourceMaps = useNitroApp().ssrSourceMaps
  return devError.createErrorReport(error, {
    cwd: rootDir,
    loaders: ssrSourceMaps ? await sourceMapLoaders(ssrSourceMaps) : [],
    context: { event },
  })
}

/**
 * Loaders resolving a frame through the SSR bundle's sourcemaps: the runner either hands
 * us maps to consult, or has mapped the stack already and only the generated position is
 * left to recover.
 */
async function sourceMapLoaders (ssrSourceMaps: SSRSourceMaps): Promise<SourceLoader[]> {
  if (ssrSourceMaps.stacksAreMapped) {
    return [compiledPositionLoader(ssrSourceMaps)]
  }
  if (!ssrSourceMaps.getSourceMap) {
    return []
  }
  const { sourceMapLoader } = await import('my-bad')
  return [sourceMapLoader({ getSourceMap: ssrSourceMaps.getSourceMap, getCode: ssrSourceMaps.getCode })]
}

/**
 * Recover the generated position of frames the runner has already mapped: the frame keeps
 * the source position it arrived with and gains the position it was compiled from.
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
export function withErrorOverlay (html: string, report: ErrorReport, options: { startMinimized?: boolean } = {}): Promise<string> {
  return devError.withErrorOverlay(html, report, { cwd: rootDir, channel: getErrorChannelPath(), startMinimized: options.startMinimized })
}

/** Render a standalone error page, for when the app itself cannot render one. */
export function renderErrorPage (report: ErrorReport): Promise<string> {
  return devError.renderErrorPage(report, { cwd: rootDir, channel: getErrorChannelPath() })
}

/**
 * Render a report for the terminal, with the project root shortened to `.`. It carries its
 * own icon and colours, so log it plainly rather than at a logger's error level.
 */
export function renderErrorAnsi (report: ErrorReport): Promise<string> {
  return devError.renderErrorAnsi(report, { cwd: rootDir })
}
