import type { ServerResponse } from 'http'

export default (_, res: ServerResponse, next) => {
  res.setHeader('injected-header', 'foo')
  next()
}
