import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  return { private: true }
})
