// @ts-ignore
import { render } from '~runtime/server'

addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url)

  if (url.pathname.startsWith('/_nuxt') || url.pathname.includes('.') /* is file :} */) {
    return
  }

  event.respondWith(handleEvent(url, event.request))
})

self.addEventListener('install', () => {
  // @ts-ignore
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // @ts-ignore
  event.waitUntil(self.clients.claim())
})

async function handleEvent (url, request) {
  try {
    const { html, status, headers } = await render(url.pathname, { req: request })
    return new Response(html, { status, headers })
  } catch (error) {
    return new Response('Internal Error: ' + error, { status: 500 })
  }
}
