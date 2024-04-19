import { consola, createConsola } from 'consola'
import type { LogObject } from 'consola'
import { parse } from 'devalue'

import { defineNuxtPlugin } from '../nuxt'

// @ts-expect-error virtual file
import { devLogs, devRootDir } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.test) { return }

  if (import.meta.server) {
    nuxtApp.ssrContext!.event.context._payloadReducers = nuxtApp.ssrContext!._payloadReducers
    return
  }

  // Show things in console
  if (devLogs !== 'silent') {
    const logger = createConsola({
      formatOptions: {
        colors: true,
        date: true,
      },
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
      },
    })
    nuxtApp.hook('dev:ssr-logs', (logs) => {
      for (const log of logs) {
        // deduplicate so we don't print out things that are logged on client
        try {
          if (!hydrationLogs.size || !hydrationLogs.has(JSON.stringify(log.args))) {
            logger.log(normalizeServerLog({ ...log }))
          }
        } catch {
          logger.log(normalizeServerLog({ ...log }))
        }
      }
    })

    nuxtApp.hooks.hook('app:suspense:resolve', () => consola.restoreAll())
    nuxtApp.hooks.hookOnce('dev:ssr-logs', () => hydrationLogs.clear())
  }

  // pass SSR logs after hydration
  nuxtApp.hooks.hook('app:suspense:resolve', async () => {
    if (typeof window !== 'undefined') {
      const content = document.getElementById('__NUXT_LOGS__')?.textContent
      const logs = content ? parse(content, nuxtApp._payloadRevivers) as LogObject[] : []
      await nuxtApp.hooks.callHook('dev:ssr-logs', logs)
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
