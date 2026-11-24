import { defineEventHandler, getQuery, setResponseStatus } from 'h3'

export default defineEventHandler(async (event) => {
  if (getQuery(event).fetch) {
    const value = await $fetch('/api/null')
    return { value: value === undefined ? 'undefined' : JSON.stringify(value) }
  }
  if (getQuery(event).status) {
    setResponseStatus(event, 202)
  }
  return null
})
