import { consola, createConsola } from 'consola'
import type { LogObject } from 'consola'

import { defineNuxtPlugin } from '../nuxt'

// @ts-expect-error virtual file
import { devLogs, devRootDir } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin((nuxtApp) => {
  // Show things in console
  if (devLogs !== 'silent') {
    const logger = createConsola({
      formatOptions: {
        colors: true,
        date: true
      }
    })
    const hydrationLogs = new Set<string>()
    consola.wrapConsole()
    consola.addReporter({
      log (logObj) {
        try {
          hydrationLogs.add(JSON.stringify(logObj.args))
        } catch {
          // silently ignore - the worst case is a user gets log twice
        }
      }
    })
    nuxtApp.hook('dev:ssr-logs', (logs) => {
      for (const log of logs) {
        // deduplicate so we don't print out things that are logged on client
        if (!hydrationLogs.size || !hydrationLogs.has(JSON.stringify(log.args))) {
          logger.log(normalizeServerLog({ ...log }))
        }
      }
    })

    nuxtApp.hooks.hook('app:suspense:resolve', () => consola.restoreAll())
    nuxtApp.hooks.hookOnce('dev:ssr-logs', () => hydrationLogs.clear())
  }

  // pass SSR logs after hydration
  nuxtApp.hooks.hook('app:suspense:resolve', async () => {
    if (window && window.__NUXT_LOGS__) {
      await nuxtApp.hooks.callHook('dev:ssr-logs', window.__NUXT_LOGS__)
    }
  })
})

function normalizeFilenames (stack?: string) {
  stack = stack?.split('\n')[0] || ''
  stack = stack.replace(`${devRootDir}/`, '')
  stack = stack.replace(/:\d+:\d+\)?$/, '')
  return stack
}

function normalizeServerLog (log: LogObject) {
  log.additional = normalizeFilenames(log.stack as string)
  log.tag = 'ssr'
  delete log.stack
  return log
}
