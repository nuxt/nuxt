import '~polyfill'
import { parseURL } from 'ufo'
import { localCall } from '../server'

export default async function handle (context, req) {
  let url: string
  if (req.headers['x-ms-original-url']) {
    // This URL has been proxied as there was no static file matching it.
    url = parseURL(req.headers['x-ms-original-url']).pathname
  } else {
    // Because Azure SWA handles /api/* calls differently they
    // never hit the proxy and we have to reconstitute the URL.
    url = '/api/' + (req.params.url || '')
  }

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
