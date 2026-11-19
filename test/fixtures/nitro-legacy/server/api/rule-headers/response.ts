import { defineEventHandler } from 'h3'

export default defineEventHandler(() => new Response('{"private":true}', { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } }))
