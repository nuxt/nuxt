import { getQuery, defineMiddleware } from 'h3'

export default defineMiddleware((req, res, next) => {
  if ('api' in getQuery(req)) {
    throw new Error('Server middleware error')
  }
  next()
})
