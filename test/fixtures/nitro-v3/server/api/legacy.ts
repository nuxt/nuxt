export default defineEventHandler(event => ({
  path: event.path,
  method: event.node.req.method,
  query: getQuery(event),
}))
