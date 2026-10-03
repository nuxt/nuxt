import { describe, expect, it } from 'vitest'
import { createError } from 'nuxt/server'

import { createFetchHandler } from '../src/runtime/renderer.ts'
import type { NuxtRenderer } from '../src/runtime/renderer.ts'

function rendererFailingWith (error: unknown, cookies: string[], pageCookies: string[] = []): NuxtRenderer {
  return {
    fetch: (event) => {
      if (event.url.pathname === '/__nuxt_error') {
        const headers = new Headers({ 'content-type': 'text/html' })
        for (const cookie of pageCookies) {
          headers.append('set-cookie', cookie)
        }
        return Promise.resolve(new Response('<div id="__nuxt">error</div>', { headers }))
      }
      for (const cookie of cookies) {
        event.res.headers.append('set-cookie', cookie)
      }
      return Promise.reject(error)
    },
  }
}

async function render (renderer: NuxtRenderer, init?: RequestInit) {
  const response = await createFetchHandler(renderer, () => ({}))(new Request('http://localhost/account', init))
  return { status: response.status, cookies: response.headers.getSetCookie(), contentType: response.headers.get('content-type'), body: await response.text() }
}

const cleared = ['session=; Max-Age=0; Path=/', 'csrf=; Max-Age=0; Path=/']

describe('error response headers', () => {
  it('keeps every cookie the failed render set', async () => {
    expect(await render(rendererFailingWith(createError({ status: 401 }), cleared))).toMatchObject({
      status: 401,
      cookies: cleared,
      contentType: 'text/html;charset=utf-8',
    })
  })

  it('keeps the cookies of an error the app did not raise', async () => {
    const error = Object.assign(new Error('[GET] "/api/me": 401 Unauthorized'), { name: 'FetchError', status: 401 })

    expect(await render(rendererFailingWith(error, cleared))).toMatchObject({ status: 401, cookies: cleared })
    expect(await render(rendererFailingWith(new Error('boom'), cleared))).toMatchObject({ status: 500, cookies: cleared })
  })

  it('adds the cookies of the error and its page', async () => {
    const error = Object.assign(createError({ status: 403 }), { headers: new Headers([['set-cookie', 'a=1'], ['set-cookie', 'b=2']]) })

    expect((await render(rendererFailingWith(error, cleared, ['page=1']))).cookies).toEqual([...cleared, 'page=1', 'a=1', 'b=2'])
  })

  it('keeps the cookies when the error page cannot render', async () => {
    const renderer: NuxtRenderer = {
      fetch: (event) => {
        event.res.headers.append('set-cookie', cleared[0]!)
        return Promise.reject(new Error('boom'))
      },
    }

    expect(await render(renderer)).toMatchObject({ status: 500, cookies: [cleared[0]], contentType: 'text/plain;charset=utf-8' })
  })
})

describe('error response for a JSON client', () => {
  it('answers with the error as JSON, keeping the cookies the failed render set', async () => {
    const error = createError({ status: 401, statusText: 'Unauthorized', data: { reason: 'expired' } })
    const response = await render(rendererFailingWith(error, cleared), { headers: { accept: 'application/json' } })

    expect(response).toMatchObject({ status: 401, cookies: cleared, contentType: 'application/json;charset=utf-8' })
    expect(JSON.parse(response.body)).toEqual({ error: true, status: 401, statusText: 'Unauthorized', message: 'Unauthorized', data: { reason: 'expired' } })
  })

  it('does not expose an error the app did not raise', async () => {
    const response = await render(rendererFailingWith(new Error('secret'), cleared), { headers: { accept: 'application/json' } })

    expect(response).toMatchObject({ status: 500, cookies: cleared })
    expect(JSON.parse(response.body)).toEqual({ error: true, status: 500, statusText: 'Internal Server Error', message: 'Internal Server Error' })
  })
})
