import { afterEach, describe, expect, it, vi } from 'vitest'

import { render } from './harness'

describe('server composables', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports a `useFetch` request that fails without a response', async () => {
    const failure = new TypeError('fetch failed')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(failure)

    const { response, html, captureError } = await render('/failing-fetch')

    expect(response.headers.get('x-fetch-error')).toBe('500')
    expect(html).not.toContain('fetch failed')
    expect(captureError).toHaveBeenCalledOnce()
    expect(captureError.mock.calls[0]![0]).toMatchObject({ name: 'FetchError', cause: failure })
    expect(captureError.mock.calls[0]![1]).toMatchObject({ tags: ['async-data'] })
  })

  it('does not report a `useFetch` request answered with an error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('missing', { status: 404 }))

    const { response, captureError } = await render('/failing-fetch')

    expect(response.headers.get('x-fetch-error')).toBe('404')
    expect(captureError).not.toHaveBeenCalled()
  })

  it('does not report a masked `useAsyncData` error that carries a status', async () => {
    const { response, captureError } = await render('/thrown-status')

    expect(response.headers.get('x-async-data-error')).toBe('500')
    expect(captureError).not.toHaveBeenCalled()
  })

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
