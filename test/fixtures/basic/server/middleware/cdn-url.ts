import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

export default defineEventHandler((event) => {
  // Only apply for the cdn test route to avoid affecting other tests
  if (event.path !== '/cdn-test') {
    return
  }
  useRuntimeConfig(event).app.cdnURL = `https://static.foo.com`
})
