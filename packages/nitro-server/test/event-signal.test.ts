import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, createRouter, eventHandler, getQuery, toNodeListener } from 'h3'

import { toPortableEvent } from '../src/runtime/utils/event.ts'

const signals = new Map<string, AbortSignal>()

const app = createApp()
const router = createRouter()

router.get('/slow', eventHandler(async (event) => {
  const signal = toPortableEvent(event).req.signal
  signals.set(getQuery(event).id as string, signal)
  await new Promise(resolve => setTimeout(resolve, 2000))
  return 'done'
}))

router.post('/fast', eventHandler((event) => {
  const request = toPortableEvent(event).req
  signals.set(getQuery(event).id as string, request.signal)
  return request.text()
}))

app.use(router)

const server = createServer(toNodeListener(app))
let base: string

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, () => resolve()))
  base = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

async function waitFor (condition: () => boolean) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > 1000) {
      throw new Error('condition was not met')
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

describe('portable event signal', () => {
  it('aborts when the client disconnects', async () => {
    const controller = new AbortController()
    const response = fetch(`${base}/slow?id=disconnect`, { signal: controller.signal }).catch(() => {})
    await waitFor(() => signals.has('disconnect'))
    expect(signals.get('disconnect')!.aborted).toBe(false)

    controller.abort()
    await response
    await waitFor(() => signals.get('disconnect')!.aborted)
  })

  it('does not abort once the response is sent', async () => {
    const text = await fetch(`${base}/fast?id=complete`, { method: 'POST', body: 'hello' }).then(r => r.text())
    expect(text).toBe('hello')

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(signals.get('complete')!.aborted).toBe(false)
  })
})
