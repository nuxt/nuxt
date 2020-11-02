// @ts-ignore
import { render } from '~runtime/server'

addEventListener('fetch', (event) => {
  // @ts-ignore
  event.respondWith(handleRequest(event.request))
})

async function handleRequest (_request) {
  // @ts-ignore
  const html = await render()
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })
}
