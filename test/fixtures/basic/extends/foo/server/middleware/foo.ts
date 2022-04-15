import type { ServerResponse } from 'node:http'

export default (_, res: ServerResponse, next) => {
  res.setHeader('injected-header', 'foo')
  next()
}
