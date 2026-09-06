import { formatWithOptions } from 'node:util'
import type { LogObject } from 'consola'
import { consola } from 'consola'
import { definePlugin } from 'nitro'
import type { LogEntry, LogLevel } from 'my-bad/channel'
import { publishDevLog, useErrorChannel } from '../utils/error-channel'

/**
 * Silences h3's own `console.error`, since the error handler renders unhandled errors
 * itself in development, and opens the channel so it is listening for reports before
 * anything requests a page.
 */
export default definePlugin((nitroApp) => {
  const h3 = nitroApp.h3 as { config: { silent?: boolean } } | undefined
  if (h3) {
    h3.config.silent = true
  }
  useErrorChannel().catch(() => {})
  streamLogsToChannel()
})

/**
 * Mirror what the server logs onto the error channel, so the log drawer of an error page
 * or overlay shows what the server was saying as it failed. When `features.devLogs` is
 * enabled, `console` is routed through consola as well, so those calls arrive here too.
 */
function streamLogsToChannel (): void {
  let publishing = false
  consola.addReporter({
    log (logObject) {
      // publishing a log must not be able to log its way back into this reporter
      if (publishing) {
        return
      }
      publishing = true
      try {
        publishDevLog(toLogEntry(logObject)).catch(() => {})
      } finally {
        publishing = false
      }
    },
  })
}

function toLogEntry (logObject: LogObject): Omit<LogEntry, 'timestamp'> & { timestamp?: number } {
  const args = logObject.args ?? []
  const message = formatWithOptions({ colors: false, depth: 2 }, ...args)
  return {
    level: toLogLevel(logObject),
    text: logObject.tag ? `[${logObject.tag}] ${message}` : message,
    timestamp: logObject.date ? new Date(logObject.date).getTime() : undefined,
  }
}

/** consola has more types than the channel has levels, and only some names line up. */
const LOG_LEVELS: Record<string, LogLevel> = {
  trace: 'trace',
  debug: 'debug',
  verbose: 'debug',
  info: 'info',
  log: 'log',
  warn: 'warn',
  error: 'error',
  fail: 'error',
  fatal: 'fatal',
}

/** consola's numeric levels, for the types whose names say nothing about severity. */
const LOG_LEVELS_BY_SEVERITY: LogLevel[] = ['error', 'warn', 'log', 'info', 'debug', 'trace']

function toLogLevel (logObject: LogObject): LogLevel {
  if (LOG_LEVELS[logObject.type]) {
    return LOG_LEVELS[logObject.type]!
  }
  const severity = Math.round(logObject.level)
  return LOG_LEVELS_BY_SEVERITY[Math.max(0, Math.min(severity, LOG_LEVELS_BY_SEVERITY.length - 1))] ?? 'log'
}
