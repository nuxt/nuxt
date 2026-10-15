import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { inspect } from 'node:util'
import { describe, expect, it } from 'vitest'

import { createResponseHeaderRecord } from '../src/runtime/utils/response.ts'

function createResponse () {
  return new ServerResponse(new IncomingMessage(new Socket()))
}

describe('createResponseHeaderRecord', () => {
  it('reads the headers of the response, without set-cookie', () => {
    const res = createResponse()
    res.setHeader('content-type', 'text/html;charset=utf-8')
    res.setHeader('link', ['</a.js>; rel=modulepreload', '</b.js>; rel=modulepreload'])
    res.setHeader('set-cookie', ['a=1', 'b=2'])

    const headers = createResponseHeaderRecord(res)

    expect(headers['content-type']).toBe('text/html;charset=utf-8')
    expect(headers['Content-Type']).toBe('text/html;charset=utf-8')
    expect('set-cookie' in headers).toBe(false)
    expect({ ...headers }).toEqual({
      'content-type': 'text/html;charset=utf-8',
      'link': '</a.js>; rel=modulepreload, </b.js>; rel=modulepreload',
    })
  })

  it('writes changes to the record onto the response', () => {
    const res = createResponse()
    res.setHeader('x-powered-by', 'Nuxt')
    res.setHeader('x-removed', 'yes')

    const headers = createResponseHeaderRecord(res)
    headers['content-security-policy'] = 'script-src \'nonce-abc\''
    delete headers['x-powered-by']
    headers['x-removed'] = undefined as unknown as string

    expect(res.getHeaders()).toEqual({ 'content-security-policy': 'script-src \'nonce-abc\'' })
  })

  it('shows its headers when inspected', () => {
    const res = createResponse()
    res.setHeader('content-type', 'text/html;charset=utf-8')
    res.setHeader('set-cookie', 'a=1')

    const headers = createResponseHeaderRecord(res)
    headers['x-render-response'] = 'yes'
    delete headers['content-type']

    expect(inspect(headers)).toBe(`{ 'x-render-response': 'yes' }`)
  })

  it('reflects headers set on the response after it was created', () => {
    const res = createResponse()
    res.setHeader('x-frame-options', 'DENY')

    const headers = createResponseHeaderRecord(res)
    res.setHeader('x-frame-options', 'SAMEORIGIN')

    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value)
    }
    expect(res.getHeader('x-frame-options')).toBe('SAMEORIGIN')
  })
})
