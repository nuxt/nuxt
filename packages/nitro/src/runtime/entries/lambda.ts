import '~polyfill'
import { localCall } from '../server'

export async function handler (event, context) {
  const r = await localCall({
    event,
    url: event.path,
    context,
    headers: event.headers,
    method: event.httpMethod,
    query: event.queryStringParameters,
    body: event.body // TODO: handle event.isBase64Encoded
  })

  return {
    statusCode: r.status,
    headers: r.headers,
    body: r.body.toString()
  }
}
