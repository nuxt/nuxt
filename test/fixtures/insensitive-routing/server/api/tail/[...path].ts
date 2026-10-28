import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(event => event.url.pathname + event.url.search)
