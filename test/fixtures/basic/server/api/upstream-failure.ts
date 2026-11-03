export default defineEventHandler(() => {
  return new Response(JSON.stringify({ secret: 'upstream-secret' }), {
    status: 502,
    headers: { 'content-type': 'application/json' },
  })
})
