import { defineEventHandler } from 'h3'

export default defineEventHandler(event => ({ api: 'nitro2', path: event.path }))
