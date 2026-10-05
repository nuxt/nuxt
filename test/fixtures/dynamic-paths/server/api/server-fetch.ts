import { defineEventHandler, matchRouteRules, serverFetch } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const response = await serverFetch(event, '/api/echo')
  return {
    status: response.status,
    echo: await response.json(),
    rules: matchRouteRules('/api/echo'),
  }
})
