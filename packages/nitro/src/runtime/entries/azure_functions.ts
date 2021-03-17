import '~polyfill'
import { localCall } from '../server'

export default async function handle (context, req) {
  const url = '/' + (req.params.url || '')

  const { body, status, statusText, headers } = await localCall({
    url,
    headers: req.headers,
    method: req.method,
    body: req.body
  })

  context.res = {
    status,
    headers,
    body: body ? body.toString() : statusText
  }
}
