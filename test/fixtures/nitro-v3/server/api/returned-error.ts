import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(() => new Response('missing', { status: 404 }))
