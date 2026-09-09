import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'x-route-header', 'from-route')
  return { ok: true }
})
