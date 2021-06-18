// @ts-nocheck
import '#polyfill'
import { localCall } from '../server'

addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url)

  if (url.pathname.includes('.') /* is file */) {
    return
  }

  event.respondWith(handleEvent(url, event))
})

async function handleEvent (url, event) {
  const r = await localCall({
    event,
    url: url.pathname,
    host: url.hostname,
    protocol: url.protocol,
    headers: event.request.headers,
    method: event.request.method,
    redirect: event.request.redirect,
    body: event.request.body
  })

  return new Response(r.body, {
    headers: r.headers,
    status: r.status,
    statusText: r.statusText
  })
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
