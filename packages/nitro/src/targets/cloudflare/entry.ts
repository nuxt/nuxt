// @ts-ignore
import { render } from '~runtime/server'

addEventListener('fetch', (event: any) => {
  event.respondWith(handleEvent(event.request))
})

async function handleEvent (request) {
  try {
    const url = new URL(request.url)
    const { html, status, headers } = await render(url.pathname, { req: request })
    return new Response(html, { status, headers })
  } catch (error) {
    return new Response('Internal Error: ' + error, { status: 500 })
  }
}
