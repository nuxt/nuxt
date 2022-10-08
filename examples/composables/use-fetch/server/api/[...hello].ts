export default defineEventHandler(event => ({
  path: '/api/' + event.context.params.hello,
  query: getQuery(event)
}))
