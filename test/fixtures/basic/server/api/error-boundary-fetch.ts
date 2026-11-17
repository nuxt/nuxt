export default defineEventHandler(() => {
  return new Response(JSON.stringify({ reason: 'missing-fetch-error' }), {
    status: 422,
    headers: { 'content-type': 'application/json' },
  })
})
