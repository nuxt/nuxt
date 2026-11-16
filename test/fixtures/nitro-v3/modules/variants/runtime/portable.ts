import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(event => ({ api: 'nuxt', path: event.url.pathname }))
