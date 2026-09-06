// the import shape `nuxt-security` 2.6.0 ships
import { defineNitroPlugin } from 'nitropack/runtime'
import { setResponseHeader } from 'h3'

export default defineNitroPlugin((nitroApp: any) => {
  nitroApp.hooks.hook('render:response', (response: { headers: Record<string, string> }, { event }: any) => {
    setResponseHeader(event, 'content-security-policy', `script-src 'nonce-test'`)
    response.headers['x-render-response'] = 'applied'
  })
})
