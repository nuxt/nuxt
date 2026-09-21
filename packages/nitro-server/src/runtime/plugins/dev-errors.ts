import { formatWithOptions } from 'node:util'
import type { LogObject } from 'consola'
import { consola } from 'consola'
import type { NitroApp } from 'nitropack/types'
import type { LogEntry, LogLevel } from 'my-bad/channel'
import { publishDevLog, useErrorChannel } from '../utils/error-channel'
import { NUXT_DEV_LOGS } from '#internal/nuxt/nitro-config.mjs'

/** Opens the error channel before anything requests a page. */
export default (_nitroApp: NitroApp): void => {
  useErrorChannel().catch(() => {})
  if (NUXT_DEV_LOGS) {
    streamLogsToChannel()
  }
}

/** Mirror what the server logs onto the error channel. */
function streamLogsToChannel (): void {
  let publishing = false
  consola.addReporter({
    log (logObject) {
      // publishing a log must not log its way back into this reporter
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

/** Fallback for consola types whose names say nothing about severity. */
const LOG_LEVELS_BY_SEVERITY: LogLevel[] = ['error', 'warn', 'log', 'info', 'debug', 'trace']

function toLogLevel (logObject: LogObject): LogLevel {
  if (LOG_LEVELS[logObject.type]) {
    return LOG_LEVELS[logObject.type]!
  }
  const severity = Math.round(logObject.level)
  return LOG_LEVELS_BY_SEVERITY[Math.max(0, Math.min(severity, LOG_LEVELS_BY_SEVERITY.length - 1))] ?? 'log'
}
