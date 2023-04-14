import type * as vite from 'vite'
import { logger } from '@nuxt/kit'
import { hasTTY, isCI } from 'std-env'
import clear from 'clear'
import type { NuxtOptions } from 'nuxt/schema'

let duplicateCount = 0
let lastType: vite.LogType | null = null
let lastMsg: string | null = null

export const logLevelMap: Record<NuxtOptions['logLevel'], vite.UserConfig['logLevel']> = {
  silent: 'silent',
  info: 'info',
  verbose: 'info'
}

export const logLevelMapReverse: Record<NonNullable<vite.UserConfig['logLevel']>, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3
}

export function createViteLogger (config: vite.InlineConfig): vite.Logger {
  const loggedErrors = new WeakSet<any>()
  const canClearScreen = hasTTY && !isCI && config.clearScreen
  const clearScreen = canClearScreen ? clear : () => {}

  function output (type: vite.LogType, msg: string, options: vite.LogErrorOptions = {}) {
    if (typeof msg === 'string' && !process.env.DEBUG) {
      // TODO: resolve upstream in Vite
      // Hide sourcemap warnings related to node_modules
      if (msg.startsWith('Sourcemap') && msg.includes('node_modules')) { return }
    }

    const sameAsLast = lastType === type && lastMsg === msg
    if (sameAsLast) {
      duplicateCount += 1
      clearScreen()
    } else {
      duplicateCount = 0
      lastType = type
      lastMsg = msg

      if (options.clear) {
        clearScreen()
      }
    }

    if (options.error) {
      loggedErrors.add(options.error)
    }

    const prevLevel = logger.level
    logger.level = logLevelMapReverse[config.logLevel || 'info']
    // TODO: colorize counter after https://github.com/unjs/consola/pull/166
    logger[type](msg + (sameAsLast ? ` (x${duplicateCount + 1})` : ''))
    logger.level = prevLevel
  }

  const warnedMessages = new Set<string>()

  const viteLogger: vite.Logger = {
    hasWarned: false,
    info (msg, opts) {
      output('info', msg, opts)
    },
    warn (msg, opts) {
      viteLogger.hasWarned = true
      output('warn', msg, opts)
    },
    warnOnce (msg, opts) {
      if (warnedMessages.has(msg)) { return }
      viteLogger.hasWarned = true
      output('warn', msg, opts)
      warnedMessages.add(msg)
    },
    error (msg, opts) {
      viteLogger.hasWarned = true
      output('error', msg, opts)
    },
    clearScreen () {
      clear()
    },
    hasErrorLogged (error) {
      return loggedErrors.has(error)
    }
  }

  return viteLogger
}
