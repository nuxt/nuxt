import { defineEventHandler, getQuery } from 'h3'

let requestCount = 0

export default defineEventHandler(async (event) => {
  const delay = Number(getQuery(event).delay ?? 50)
  await new Promise(resolve => setTimeout(resolve, delay))
  requestCount++
  return {
    greeting: 'hello from api',
    requestCount,
  }
})
