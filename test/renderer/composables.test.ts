import { describe, expect, it } from 'vitest'

import { render } from './harness'

describe('server composables', () => {
  it('reads back a response header written with `useResponseHeader`', async () => {
    const { response } = await render('/response-header')

    expect(response.headers.get('x-written')).toBe('written')
    expect(response.headers.get('x-read-back')).toBe('undefined -> written')
  })

  it('reports a cookie that cannot be serialized', async () => {
    await expect(render('/invalid-cookie')).rejects.toMatchObject({
      code: 'NUXT_E7011',
      cause: expect.any(TypeError),
    })
  })
})
