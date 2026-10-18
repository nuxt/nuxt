import { describe, expect, it } from 'vitest'
import { createEvent, options } from './harness'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'
import { getRequestState } from '../../packages/nuxt/src/runtime/server/renderer/runtime.ts'

describe('error rendering delegated to the server runtime', () => {
  it('refuses an internal error route with the error the runtime constructs', async () => {
    const renderer = createNuxtRenderer(options)

    await expect(renderer.fetch(createEvent('/__nuxt_error'))).rejects.toMatchObject({ status: 404 })
  })

  it('throws a failed render back to the runtime, leaving the headers it had written on the request state', async () => {
    const renderer = createNuxtRenderer(options)
    const event = createEvent('/throws')
    event.res.headers.append('set-cookie', 'session=1')

    const error = await renderer.fetch(event).catch(error => error)
    expect(error).toMatchObject({ status: 503 })
    expect(error.headers).toBeUndefined()
    expect(getRequestState(event)?.['~response-headers']?.getSetCookie()).toEqual(['session=1'])
  })
})
