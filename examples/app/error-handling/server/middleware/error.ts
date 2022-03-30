import { useQuery, defineMiddleware } from 'h3'

export default defineMiddleware((req, res, next) => {
  if ('api' in useQuery(req)) {
    throw new Error('Server middleware error')
  }
  next()
})
