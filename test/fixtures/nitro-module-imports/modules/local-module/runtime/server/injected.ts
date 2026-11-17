export default defineEventHandler(event => ({
  query: getQuery(event),
  baseURL: useRuntimeConfig(event).app.baseURL,
}))
