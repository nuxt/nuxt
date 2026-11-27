import type { NitroErrorHandler } from 'nitro/types'

export default <NitroErrorHandler> function (error, event) {
  if (!new URL(event.req.url).pathname.startsWith('/api/no-store/module')) { return }
  return new Response(JSON.stringify({ status: error.status }), {
    status: error.status,
    headers: { 'content-type': 'application/json' },
  })
}
