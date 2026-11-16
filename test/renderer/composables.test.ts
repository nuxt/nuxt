import { describe, expect, it } from 'vitest'

import { render } from './harness'

describe('server composables', () => {
  it('reads back a response header written with `useResponseHeader`', async () => {
    const { response } = await render('/response-header')

    expect(response.headers.get('x-written')).toBe('written')
    expect(response.headers.get('x-read-back')).toBe('null -> written')
  })

  it('reports a cookie that cannot be serialized', async () => {
    const { response, captureError } = await render('/invalid-cookie')

    expect(response.status).toBe(500)
    expect(response.headers.getSetCookie()).toEqual([])
    expect(captureError.mock.calls[0]![0]).toMatchObject({
      code: 'NUXT_E7011',
      cause: expect.any(TypeError),
    })
  })
})
