import { h } from 'vue'
import { defineNuxtPlugin } from '../nuxt'
import type { DevServerLog, ObjectPlugin, Plugin } from '../nuxt'

const devRevivers: Record<string, (data: any) => any> = import.meta.server
  ? {}
  : {
      VNode: data => h(data.type, data.props),
      URL: data => new URL(data),
      Symbol: data => Symbol.for(data),
    }

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin(async (nuxtApp) => {
  if (import.meta.test) { return }

  if (import.meta.server) {
    nuxtApp.ssrContext!.event.context['~payloadReducers'] = nuxtApp.ssrContext!['~payloadReducers']
    return
  }

  if (typeof window !== 'undefined') {
    const nuxtLogsElement = document.querySelector(`[data-nuxt-logs="${nuxtApp._id}"]`)
    const content = nuxtLogsElement?.textContent
    if (content) {
      const { parse } = await import('devalue')
      const logs = parse(content, { ...devRevivers, ...nuxtApp._payloadRevivers }) as DevServerLog[]
      await nuxtApp.hooks.callHook('dev:ssr-logs', logs)
    }
  }
})

export default plugin
