import { describe, expect, it } from 'vitest'

import { render } from './harness'

describe('server composables', () => {
  it('reads back a response header written with `useResponseHeader`', async () => {
    const { response } = await render('/response-header')

    expect(response.headers.get('x-written')).toBe('written')
    expect(response.headers.get('x-read-back')).toBe('null -> written')
  })
})
