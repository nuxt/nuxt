import { getQuery } from 'h3'
import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin((nitroApp: any) => {
  nitroApp.hooks.hook('render:response', (response: { statusCode?: number, statusMessage?: string, headers?: Record<string, string> }, { event }: any) => {
    response.headers ||= {}
    response.headers['x-render-response'] = 'applied'
    const status = getQuery(event).status
    if (status) {
      response.statusCode = Number(status)
      response.statusMessage = 'From render:response'
    }
  })
})
