import type { Channel } from 'my-bad/channel'
import type { ErrorReport, SourceLoader } from 'my-bad'
import type { SSRSourceMaps } from '../../augments'
import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import { useNitroApp, useRuntimeConfig } from 'nitropack/runtime'
import { isMainThread } from 'node:worker_threads'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { joinURL } from 'ufo'
import { rootDir, srcDir } from '#internal/dev-server-logs-options'
import * as devError from 'nuxt/internal/dev-error'

import { NUXT_ERROR_CHANNEL } from '#internal/nuxt/nitro-config.mjs'

export const ERROR_CHANNEL_ENV = devError.ERROR_CHANNEL_ENV
export const ERROR_CHANNEL_BROADCAST = devError.ERROR_CHANNEL_BROADCAST

export { clearErrorReport, publishDevLog, publishDevProgress, serializeErrorCause } from 'nuxt/internal/dev-error'
export type { ErrorChannelMessage } from 'nuxt/internal/dev-error'

/** Whether reports should be forwarded to the dev server that set {@link ERROR_CHANNEL_ENV}. */
export function shouldForwardReports (env: NodeJS.ProcessEnv = process.env, mainThread: boolean = isMainThread): boolean {
  return !!env[ERROR_CHANNEL_ENV] && !mainThread
}

/** Base path pages should subscribe to. */
export function getErrorChannelPath (): string {
  return process.env[ERROR_CHANNEL_ENV] || joinURL(useRuntimeConfig().app.baseURL, NUXT_ERROR_CHANNEL)
}

devError.setErrorChannelForwarding(() => shouldForwardReports())

/** The live error channel, forwarding to the dev server in front when there is one. */
export function useErrorChannel (): Promise<Channel> {
  return devError.useErrorChannel()
}

/** Publish a report as the current error, paired with the request it came from. */
export function publishErrorReport (report: ErrorReport, event?: H3Event): Promise<void> {
  return devError.publishErrorReport(report, event && { method: event.method, url: getRequestURL(event), headers: event.headers })
}

/**
 * Build a report for an error raised while rendering. Must run on the stack as it was
 * raised, since frames are mapped through the SSR bundle's sourcemaps.
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
 * Resolve a bundler module id such as `/app.vue`, which reads as an absolute path but is
 * relative to the environment root, to a file the developer can open.
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

/**
 * Recover the generated position of frames the runner has already mapped. A frame mapped
 * to its module but not to a line in it points at generated code, so counts as a vendor frame.
 */
function compiledPositionLoader (ssrSourceMaps: SSRSourceMaps): SourceLoader {
  return {
    name: 'nuxt-compiled-position',
    map (frame) {
      if (!frame.file || frame.line === undefined || frame.compiled) {
        return undefined
      }
      const compiled = ssrSourceMaps.getCompiledPosition?.(frame.file, frame.line, frame.column)
      if (compiled) {
        return { ...frame, compiled }
      }
      return ssrSourceMaps.getCode(frame.file) !== undefined && frame.line > lineCount(frame.file) ? { ...frame, type: 'vendor' } : undefined
    },
    readCompiled: file => ssrSourceMaps.getCode(file),
  }
}

function lineCount (file: string): number {
  try {
    return readFileSync(file, 'utf8').split('\n').length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

/** Add the error overlay to an already-rendered page. */
export function withErrorOverlay (html: string, report: ErrorReport, options: { startMinimized?: boolean, event?: H3Event } = {}): Promise<string> {
  return devError.withErrorOverlay(html, report, { cwd: rootDir, channel: getErrorChannelPath(), requestId: requestIdOf(options.event), startMinimized: options.startMinimized })
}

/** Render a standalone error page, for when the app itself cannot render one. */
export function renderErrorPage (report: ErrorReport, event?: H3Event): Promise<string> {
  return devError.renderErrorPage(report, { cwd: rootDir, channel: getErrorChannelPath(), requestId: requestIdOf(event) })
}

function requestIdOf (event?: H3Event): string | undefined {
  return event && devError.requestIdOf({ headers: event.headers })
}

/** Render a report for the terminal. */
export function renderErrorAnsi (report: ErrorReport): Promise<string> {
  return devError.renderErrorAnsi(report, { cwd: rootDir })
}
