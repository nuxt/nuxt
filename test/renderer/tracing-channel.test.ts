import { tracingChannel } from 'node:diagnostics_channel'
import { describe, expect, it, vi } from 'vitest'
import { createEvent, render } from './harness'

vi.mock('nuxt/internal/renderer-config', async (importOriginal) => {
  return { ...(await importOriginal<Record<string, unknown>>()), tracingChannelNuxt: true }
})

describe('nuxt.request tracing channel', () => {
  it('wraps the render of each request', async () => {
    const events: string[] = []
    const contexts: any[] = []
    const request = {
      start: (ctx: any) => {
        events.push('request:start')
        contexts.push(ctx)
      },
      asyncEnd: () => events.push('request:asyncEnd'),
    }
    const renderEvents = {
      start: () => events.push('render:start'),
      asyncEnd: () => events.push('render:asyncEnd'),
    }
    const requestChannel = tracingChannel('nuxt.request')
    const renderChannel = tracingChannel('nuxt.render')
    requestChannel.subscribe(request as any)
    renderChannel.subscribe(renderEvents as any)
    try {
      const event = createEvent('/')
      const { response } = await render('/', undefined, event)

      expect(response.status).toBe(200)
      expect(events).toEqual([
        'request:start',
        'render:start',
        'render:asyncEnd',
        'request:asyncEnd',
      ])
      expect(contexts).toHaveLength(1)
      expect(contexts[0].event).toBe(event)
    } finally {
      requestChannel.unsubscribe(request as any)
      renderChannel.unsubscribe(renderEvents as any)
    }
  })

  it('publishes the app event when the server runtime provides one', async () => {
    const contexts: any[] = []
    const request = { start: (ctx: any) => contexts.push(ctx) }
    const channel = tracingChannel('nuxt.request')
    channel.subscribe(request as any)
    try {
      const event = createEvent('/')
      const app = { url: event.url }
      Object.assign(event, { '~app': app })
      await render('/', undefined, event)

      expect(contexts[0].event).toBe(app)
    } finally {
      channel.unsubscribe(request as any)
    }
  })
})
