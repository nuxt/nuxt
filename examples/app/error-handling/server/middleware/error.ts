import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler((event) => {
  if ('api' in getQuery(event)) {
    throw new Error('Server middleware error')
  }
})
