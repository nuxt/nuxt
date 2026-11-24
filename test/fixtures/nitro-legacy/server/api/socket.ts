import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler((event) => {
  if (getQuery(event).sub) {
    return event.$fetch('/api/socket')
  }
  return { inProcess: event.context.inProcess }
})
