import { defineEventHandler } from 'h3'

export default defineEventHandler(event => ({ path: event.path }))
