import { resolve } from 'pathe'
import { describe } from 'vitest'
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda'
import { setupTest, testNitroBehavior, importModule } from './_tests'

describe('nitro:preset:lambda', () => {
  const ctx = setupTest('lambda')
  // Lambda v1 paylod
  testNitroBehavior(ctx, async () => {
    const { handler } = await importModule(resolve(ctx.outDir, 'server/index.mjs'))
    return async ({ url: rawRelativeUrl, headers, method, body }) => {
      // creating new URL object to parse query easier
      const url = new URL(`https://example.com${rawRelativeUrl}`)
      const queryStringParameters = Object.fromEntries(url.searchParams.entries())
      const event: Partial<APIGatewayProxyEvent> = {
        resource: '/my/path',
        path: url.pathname,
        headers: headers || {},
        httpMethod: method || 'GET',
        queryStringParameters,
        body: body || ''
      }
      const res = await handler(event)
      return {
        data: res.body
      }
    }
  })
  // Lambda v2 paylod
  testNitroBehavior(ctx, async () => {
    const { handler } = await importModule(resolve(ctx.outDir, 'server/index.mjs'))
    return async ({ url: rawRelativeUrl, headers, method, body }) => {
      // creating new URL object to parse query easier
      const url = new URL(`https://example.com${rawRelativeUrl}`)
      const queryStringParameters = Object.fromEntries(url.searchParams.entries())
      const event: Partial<APIGatewayProxyEventV2> = {
        rawPath: url.pathname,
        headers: headers || {},
        requestContext: {
          ...Object.fromEntries([['accountId'], ['apiId'], ['domainName'], ['domainPrefix']]),
          http: {
            path: url.pathname,
            protocol: 'http',
            ...Object.fromEntries([['userAgent'], ['sourceIp']]),
            method: method || 'GET'
          }
        },
        queryStringParameters,
        body: body || ''
      }
      const res = await handler(event)
      return {
        data: res.body
      }
    }
  })
})
