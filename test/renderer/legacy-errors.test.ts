import { describe, expect, it } from 'vitest'
import { createEvent, options } from './harness'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'

describe('error rendering delegated to the server runtime', () => {
  it('refuses an internal error route with the error the runtime constructs', async () => {
    const renderer = createNuxtRenderer(options)

    await expect(renderer.fetch(createEvent('/__nuxt_error'))).rejects.toMatchObject({ status: 404 })
  })

  it('throws a failed render back to the runtime, carrying the headers it had written', async () => {
    const renderer = createNuxtRenderer(options)
    const event = createEvent('/throws')
    event.res.headers.append('set-cookie', 'session=1')

    await expect(renderer.fetch(event)).rejects.toMatchObject({
      status: 503,
      headers: expect.objectContaining({ getSetCookie: expect.any(Function) }),
    })
  })
})
