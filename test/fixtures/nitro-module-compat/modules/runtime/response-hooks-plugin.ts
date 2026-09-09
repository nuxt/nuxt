import { defineNitroPlugin } from 'nitropack/runtime'
import { removeResponseHeader, setResponseHeader } from 'h3'

export default defineNitroPlugin((nitroApp: any) => {
  nitroApp.hooks.hook('beforeResponse', (event: any, response: any) => {
    response.response.headers.set('x-before-response', 'applied')
    removeResponseHeader(event, 'x-route-header')
    setResponseHeader(event, 'x-legacy-header', 'applied')
  })
})
