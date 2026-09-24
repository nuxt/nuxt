import { describe, expect, it } from 'vitest'
import { createEvent, options, render } from './harness'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'

describe('inline error rendering', () => {
  it('renders the error page in process, with the status the render failed with', async () => {
    const { response, html } = await render('/throws')

    expect(response.status).toBe(503)
    expect(response.statusText).toBe('Service Unavailable')
    expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8')
    expect(response.headers.get('vary')).toBe('accept, sec-fetch-mode')

    expect(html).toContain('<div id="error-page">')
    expect(html).toContain('<h1>503</h1>')
    expect(html).toContain('the render threw')
    expect(html).toContain('<p id="error-url">/throws</p>')
  })

  it('answers a bare throw from the app with a 500 carrying its message', async () => {
    const { response, html } = await render('/unhandled')

    expect(response.status).toBe(500)
    expect(html).toContain('<h1>500</h1>')
    expect(html).toContain('<p id="error-message">an unhandled failure</p>')
  })

  // an `ofetch` failure against an internal service, and the same error once h3 has wrapped it
  it.each([
    ['a foreign error carrying a status', { name: 'FetchError' }],
    ['an error already marked unhandled', { name: 'HTTPError', unhandled: true }],
  ])('scrubs %s', async (_, shape) => {
    const upstream = Object.assign(new Error('[GET] "http://internal-api:8080/secrets": 502 Bad Gateway'), {
      status: 502,
      statusText: 'Bad Gateway',
      data: { token: 'super-secret' },
      headers: { 'set-cookie': 'upstream-session=1' },
    }, shape)
    let rules = 0
    const { response, html } = await render('/', {
      getRouteRules: () => {
        if (++rules === 1) { throw upstream }
        return { ssr: true }
      },
    })

    expect(response.status).toBe(502)
    expect(response.statusText).toBe('Bad Gateway')
    expect(response.headers.getSetCookie()).toEqual([])
    expect(html).not.toContain('internal-api:8080')
    expect(html).not.toContain('super-secret')
  })

  it('hides the message of an error raised outside the app', async () => {
    let rules = 0
    const { response, html } = await render('/', {
      getRouteRules: () => {
        if (++rules === 1) {
          throw new Error('the route rules blew up')
        }
        return { ssr: true }
      },
    })

    expect(response.status).toBe(500)
    expect(response.statusText).toBe('Internal Server Error')
    expect(html).toContain('<div id="error-page">')
    expect(html).not.toContain('the route rules blew up')
  })

  it('lets the error page redirect rather than answering with the error status', async () => {
    const { response } = await render('/throws/redirect-from-error-page')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/')
  })

  it('keeps error data the payload can carry, dropping what it cannot', async () => {
    const { response, html } = await render('/rich-data')

    expect(response.status).toBe(418)
    expect(html).toContain('<div id="error-page">')
    expect(html).toContain('"keep"')
    expect(html).toContain('yes')
  })

  it('reports the error to the runtime exactly once', async () => {
    const { captureError } = await render('/throws')

    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError.mock.calls[0]![0]).toMatchObject({ message: 'the render threw' })
    expect(captureError.mock.calls[0]![1].tags).toBeUndefined()
  })

  it('answers with the error status, not one the failed render had set', async () => {
    const event = createEvent('/throws')
    ;(event.res as { status?: number, statusText?: string }).status = 201
    ;(event.res as { status?: number, statusText?: string }).statusText = 'Created'

    const { response } = await render('/throws', undefined, event)

    expect(response.status).toBe(503)
    expect(response.statusText).toBe('Service Unavailable')
  })

  it('server-renders the error page on a route that opted out of SSR', async () => {
    let rules = 0
    const { response, html } = await render('/', {
      getRouteRules: () => {
        if (++rules === 1) { throw Object.assign(new Error('gone'), { name: 'HTTPError', status: 410, statusText: 'Gone' }) }
        return { ssr: false }
      },
    })

    expect(response.status).toBe(410)
    expect(html).toContain('<div id="error-page">')
  })

  it('keeps the headers the failed render had already written', async () => {
    const event = createEvent('/throws')
    event.res.headers.append('set-cookie', 'session=1')
    event.res.headers.set('x-from-middleware', 'yes')

    const { response } = await render('/throws', undefined, event)

    expect(response.headers.getSetCookie()).toContain('session=1')
    expect(response.headers.get('x-from-middleware')).toBe('yes')
  })

  it('falls back to the static template when the error page render throws, without rendering again', async () => {
    let renders = 0
    const { response, html, captureError } = await render('/throws', {
      getRouteRules: () => {
        if (++renders > 1) {
          throw new Error('the error page render threw')
        }
        return { ssr: true }
      },
    })

    expect(renders).toBe(2)
    expect(response.status).toBe(503)
    expect(response.statusText).toBe('Service Unavailable')
    expect(html).not.toContain('<div id="error-page">')
    expect(html).toContain('<h1 class="font-medium leading-none mb-4 sm:text-[72px] tabular-nums text-[56px]">503</h1>')

    expect(captureError).toHaveBeenCalledTimes(2)
    expect(captureError.mock.calls[0]![1].tags).toBeUndefined()
    expect(captureError.mock.calls[1]![0]).toMatchObject({ message: 'the error page render threw' })
    expect(captureError.mock.calls[1]![1].tags).toEqual(['error-page'])
  })

  it('never answers a payload request with an error page', async () => {
    const renderer = createNuxtRenderer(options)

    await expect(renderer.fetch(createEvent('/throws/_payload.json'))).rejects.toMatchObject({ message: 'the render threw' })
  })

  it('leaves an error the runtime is already rendering its own error page for to the runtime', async () => {
    const renderer = createNuxtRenderer(options)
    const event = createEvent('/throws')
    ;(event.context as { nuxt?: Record<string, unknown> }).nuxt = { '~rendering-error': true }

    await expect(renderer.fetch(event)).rejects.toMatchObject({ message: 'the render threw' })
  })

  it('answers a direct request for the internal error route with the app error page', async () => {
    const { response, html } = await render('/__nuxt_error')

    expect(response.status).toBe(404)
    expect(html).toContain('<div id="error-page">')
    expect(html).toContain('<h1>404</h1>')
  })

  it('survives an error sink that throws', async () => {
    const { response } = await render('/throws', {
      captureError: () => {
        throw new Error('the sink failed')
      },
    })

    expect(response.status).toBe(503)
  })
})
