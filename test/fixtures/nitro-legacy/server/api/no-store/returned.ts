import { defineEventHandler } from 'h3'

export default defineEventHandler(() => new Response(JSON.stringify({ returned: true }), { status: 401, headers: { 'content-type': 'application/json' } }))
