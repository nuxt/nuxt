import { AsyncLocalStorage } from 'node:async_hooks'
import type { LogObject } from 'consola'
import { consola } from 'consola'
import { stringify } from 'devalue'
import type { H3Event } from 'h3'
import { withTrailingSlash } from 'ufo'
import { getContext } from 'unctx'
import { captureRawStackTrace, parseRawStackTrace } from 'errx'
import type { ParsedTrace } from 'errx'

import { isVNode } from 'vue'
import type { NitroApp } from 'nitropack/types'

import { serverDiagnostics } from '../diagnostics'
import { rootDir } from '#internal/dev-server-logs-options'
import { appId } from '#internal/nuxt.config.mjs'

const devReducers: Record<string, (data: any) => any> = {
  VNode: data => isVNode(data) ? { type: data.type, props: data.props } : undefined,
  URL: data => data instanceof URL ? data.toString() : undefined,
  Symbol: data => typeof data === 'symbol' ? data.description ?? '' : undefined,
}

interface NuxtDevAsyncContext {
  logs: LogObject[]
  event: H3Event
}

function appendLogs (ctx: NuxtDevAsyncContext, bodyAppend: string[]) {
  try {
    const reducers = Object.assign(Object.create(null), devReducers, ctx.event.context['~payloadReducers'])
    bodyAppend.unshift(`<script type="application/json" data-nuxt-logs="${appId}">${stringify(ctx.logs, reducers)}</script>`)
  } catch (e) {
    serverDiagnostics.NUXT_E8003({ error: e instanceof Error ? e.toString() : undefined, cause: e })
  }
}

const asyncContext = getContext<NuxtDevAsyncContext>('nuxt-dev', { asyncContext: true, AsyncLocalStorage })

export default (nitroApp: NitroApp): void => {
  const handler = nitroApp.h3App.handler
  nitroApp.h3App.handler = (event) => {
    return asyncContext.callAsync({ logs: [], event }, () => handler(event))
  }

  onConsoleLog((_log) => {
    const ctx = asyncContext.tryUse()
    if (!ctx) { return }

    const rawStack = captureRawStackTrace()
    if (!rawStack || rawStack.includes('runtime/vite-node.mjs')) { return }

    const trace: ParsedTrace[] = []
    let filename = ''
    for (const entry of parseRawStackTrace(rawStack)) {
      if (entry.source === import.meta.url) { continue }
      if (EXCLUDE_TRACE_RE.test(entry.source)) { continue }

      filename ||= entry.source.replace(withTrailingSlash(rootDir), '')
      trace.push({
        ...entry,
        source: entry.source.startsWith('file://') ? entry.source.replace('file://', '') : entry.source,
      })
    }

    const log = {
      ..._log,
      // Pass along filename to allow the client to display more info about where log comes from
      filename,
      // Clean up file names in stack trace
      stack: trace,
    }

    // retain log to be include in the next render
    ctx.logs.push(log)
  })

  nitroApp.hooks.hook('afterResponse', () => {
    const ctx = asyncContext.tryUse()
    if (!ctx) { return }
    return nitroApp.hooks.callHook('dev:ssr-logs', { logs: ctx.logs, path: ctx.event.path })
  })

  // `render:html` runs before a streamed body is rendered, so streamed logs are
  // attached from `render:html:close` once the render is complete.
  nitroApp.hooks.hook('render:html', (htmlContext, { streaming }) => {
    if (streaming) { return }

    const ctx = asyncContext.tryUse()
    if (!ctx) { return }
    appendLogs(ctx, htmlContext.bodyAppend)
  })

  nitroApp.hooks.hook('render:html:close', (closeContext) => {
    const ctx = asyncContext.tryUse()
    if (!ctx) { return }
    appendLogs(ctx, closeContext.bodyAppend)
  })
}

const EXCLUDE_TRACE_RE = /\/node_modules\/(?:.*\/)?(?:nuxt|nuxt-nightly|nuxt-edge|nuxt3|consola|@vue)\/|core\/runtime\/nitro/

function onConsoleLog (callback: (log: LogObject) => void) {
  consola.addReporter({
    log (logObj) {
      callback(logObj)
    },
  })
  consola.wrapConsole()
}
