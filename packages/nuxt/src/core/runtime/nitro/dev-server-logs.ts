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
import type { NitroApp } from 'nitro/types'

// @ts-expect-error virtual file
import { rootDir } from '#internal/dev-server-logs-options'
// @ts-expect-error virtual file
import { appId } from '#internal/nuxt.config.mjs'

const devReducers: Record<string, (data: any) => any> = {
  VNode: data => isVNode(data) ? { type: data.type, props: data.props } : undefined,
  URL: data => data instanceof URL ? data.toString() : undefined,
}

interface NuxtDevAsyncContext {
  logs: LogObject[]
  event: H3Event
}

const asyncContext = getContext<NuxtDevAsyncContext>('nuxt-dev', { asyncContext: true, AsyncLocalStorage })

export default (nitroApp: NitroApp) => {
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

  // Pass any logs to the client
  nitroApp.hooks.hook('render:html', (htmlContext) => {
    const ctx = asyncContext.tryUse()
    if (!ctx) { return }
    try {
      const reducers = Object.assign(Object.create(null), devReducers, ctx.event.context._payloadReducers)
      htmlContext.bodyAppend.unshift(`<script type="application/json" data-nuxt-logs="${appId}">${stringify(ctx.logs, reducers)}</script>`)
    } catch (e) {
      const shortError = e instanceof Error && 'toString' in e ? ` Received \`${e.toString()}\`.` : ''
      console.warn(`[nuxt] Failed to stringify dev server logs.${shortError} You can define your own reducer/reviver for rich types following the instructions in https://nuxt.com/docs/api/composables/use-nuxt-app#payload.`)
    }
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
