import type { APIGatewayProxyEvent, APIGatewayProxyEventHeaders, APIGatewayProxyEventV2, APIGatewayProxyResult, APIGatewayProxyResultV2, Context } from 'aws-lambda'
import '#polyfill'
import { withQuery } from 'ufo'
import type { HeadersObject } from 'unenv/runtime/_internal/types'
import { localCall } from '../server'

export const handler = async function handler (event: APIGatewayProxyEvent | APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResult | APIGatewayProxyResultV2> {
  const url = withQuery((event as APIGatewayProxyEvent).path || (event as APIGatewayProxyEventV2).rawPath, event.queryStringParameters)
  const method = (event as APIGatewayProxyEvent).httpMethod || (event as APIGatewayProxyEventV2).requestContext?.http?.method || 'get'

  if ('cookies' in event) {
    event.headers.cookie = event.cookies.join(',')
  }

  const r = await localCall({
    event,
    url,
    context,
    headers: normalizeIncomingHeaders(event.headers),
    method,
    query: event.queryStringParameters,
    body: event.body // TODO: handle event.isBase64Encoded
  })

  return {
    statusCode: r.status,
    headers: normalizeOutgoingHeaders(r.headers),
    body: r.body.toString()
  }
}

function normalizeIncomingHeaders (headers: APIGatewayProxyEventHeaders) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
}

function normalizeOutgoingHeaders (headers: HeadersObject) {
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v]))
}
