import { createConsola } from 'consola'
import type { LogObject } from 'consola'
import { parse } from 'devalue'

import { h } from 'vue'
import { defineNuxtPlugin } from '../nuxt'

// @ts-expect-error virtual file
import { devLogs, devRootDir } from '#build/nuxt.config.mjs'

const devRevivers: Record<string, (data: any) => any> = import.meta.server
  ? {}
  : {
      VNode: data => h(data.type, data.props),
      URL: data => new URL(data),
    }

export default defineNuxtPlugin(async (nuxtApp) => {
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
    nuxtApp.hook('dev:ssr-logs', (logs) => {
      for (const log of logs) {
        logger.log(normalizeServerLog({ ...log }))
      }
    })
  }

  if (typeof window !== 'undefined') {
    const content = document.getElementById('__NUXT_LOGS__')?.textContent
    const logs = content ? parse(content, { ...devRevivers, ...nuxtApp._payloadRevivers }) as LogObject[] : []
    await nuxtApp.hooks.callHook('dev:ssr-logs', logs)
  }
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
