import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  event.context.bodyFromMiddleware = await readBody(event)
})
