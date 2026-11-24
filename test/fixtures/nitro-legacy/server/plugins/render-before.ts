import { createError, setCookie } from 'h3'
import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin(async (nitroApp: any) => {
  await Promise.resolve()
  nitroApp.hooks.hook('render:before', (context: any) => {
    const { event } = context
    if (event.path === '/render-before-response') {
      context.response = { body: new Response('from a web response', { status: 203, headers: { 'x-from': 'response' } }) }
      return
    }
    if (event.path === '/render-before-error') {
      context.response = { body: createError({ statusCode: 418, statusMessage: 'Teapot' }) }
      return
    }
    if (event.path !== '/render-before') {
      return
    }
    setCookie(event, 'locale', 'fr', { path: '/' })
    event.node.res.setHeader('location', '/fr')
    event.node.res.statusCode = 302
    context.response = {
      headers: event.node.res.getHeaders(),
      statusCode: event.node.res.statusCode,
      body: '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/fr"></head></html>',
    }
  })
})
