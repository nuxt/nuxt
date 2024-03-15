import type { LogObject } from 'consola'
import { consola } from 'consola'
import devalue from '@nuxt/devalue'
import { createHooks } from 'hookable'
import { createEventStream, defineEventHandler } from 'h3'
import { withTrailingSlash } from 'ufo'

import type { NitroApp } from '#internal/nitro/app'

// @ts-expect-error virtual file
import { rootDir } from '#internal/dev-server-logs-options'

export default (nitroApp: NitroApp) => {
  const hooks = createHooks<{ log:(data: any) => void }>()
  const logs: LogObject[] = []

  onConsoleLog((_log) => {
    const stack = getStack()

    const log = {
      ..._log,
      // Pass along filename to allow the client to display more info about where log comes from
      filename: extractFilenameFromStack(stack),
      // Clean up file names in stack trace
      stack: normalizeFilenames(stack)
    }

    // retain log to be include in the next render
    logs.push(log)
    // send log messages to client via SSE
    hooks.callHook('log', log)
  })

  // Add SSE endpoint for streaming logs to the client
  nitroApp.router.add('/_nuxt_logs', defineEventHandler((event) => {
    const eventStream = createEventStream(event)

    const unsubscribe = hooks.hook('log', async (data) => {
      await eventStream.push(JSON.stringify(data))
    })

    eventStream.onClosed(async () => {
      unsubscribe()
      await eventStream.close()
    })

    return eventStream.send()
  }))

  // Pass any unhandled logs to the client
  nitroApp.hooks.hook('render:html', (htmlContext) => {
    htmlContext.bodyAppend.unshift(`<script>window.__NUXT_LOGS__ = ${devalue(logs)}</script>`)
    logs.length = 0
  })
}

const EXCLUDE_TRACE_RE = /^.*at.*(\/node_modules\/(.*\/)?(nuxt|consola|@vue)\/.*|core\/runtime\/nitro.*)$\n?/gm
function getStack () {
  // Pass along stack traces if needed (for error and warns)
  // eslint-disable-next-line unicorn/error-message
  const stack = new Error()
  Error.captureStackTrace(stack)
  return stack.stack?.replace(EXCLUDE_TRACE_RE, '').replace(/^Error.*\n/, '') || ''
}

const FILENAME_RE = /at.*\(([^:)]+)[):]/
const FILENAME_RE_GLOBAL = /at.*\(([^)]+)\)/g
function extractFilenameFromStack (stacktrace: string) {
  return stacktrace.match(FILENAME_RE)?.[1].replace(withTrailingSlash(rootDir), '')
}
function normalizeFilenames (stacktrace: string) {
  // remove line numbers and file: protocol - TODO: sourcemap support for line numbers
  return stacktrace.replace(FILENAME_RE_GLOBAL, (match, filename) => match.replace(filename, filename.replace('file:///', '/').replace(/:.*$/, '')))
}

function onConsoleLog (callback: (log: LogObject) => void) {
  consola.addReporter({
    log (logObj) {
      callback(logObj)
    }
  })
  consola.wrapAll()
}
