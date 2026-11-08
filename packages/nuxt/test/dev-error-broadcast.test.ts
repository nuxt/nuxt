import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorReport } from 'my-bad'
import { publishDevLog, publishDevProgress, publishErrorReport, setErrorChannelForwarding, useErrorChannel } from '../src/runtime/server/dev-error/index'

const report = { id: 'abc', kind: 'error', name: 'Error', message: 'boom', frames: [], causes: [], sections: [], timestamp: 0 } as unknown as ErrorReport

describe('dev error channel without a working `BroadcastChannel`', () => {
  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', function () {
      throw new TypeError('Cannot read properties of undefined (reading \'on\')')
    })
  })

  afterEach(async () => {
    const store = globalThis as Record<symbol, Promise<{ close: () => void }> | undefined>
    ;(await store[Symbol.for('nuxt:dev:error-channel')])?.close()
    delete store[Symbol.for('nuxt:dev:error-channel')]
    setErrorChannelForwarding(() => false)
    vi.unstubAllGlobals()
  })

  it('serves reports from an owned channel', async () => {
    setErrorChannelForwarding(() => false)
    await publishErrorReport(report)
    await publishDevLog({ level: 'warn', text: 'careful' })
    await publishDevProgress({ phase: 'transform', message: 'Rebuilding' })

    const channel = await useErrorChannel()
    expect(channel.current).toBe(report)
    expect(channel.getReport('abc')).toBe(report)
    channel.clearError()
    expect(channel.current).toBeUndefined()
  })

  it('keeps a forwarding channel usable', async () => {
    setErrorChannelForwarding(() => true)
    await publishErrorReport(report)
    await publishDevLog({ level: 'warn', text: 'careful' })
    await publishDevProgress({ phase: 'transform', message: 'Rebuilding' })

    const channel = await useErrorChannel()
    expect(channel.current).toBe(report)
    channel.clearError()
    expect(channel.current).toBeUndefined()
  })
})

describe('dev error channel problem sets', () => {
  afterEach(async () => {
    const store = globalThis as Record<symbol, Promise<{ close: () => void }> | undefined>
    ;(await store[Symbol.for('nuxt:dev:error-channel')])?.close()
    delete store[Symbol.for('nuxt:dev:error-channel')]
    setErrorChannelForwarding(() => false)
  })

  it('keeps the request a report another thread posts came from', async () => {
    setErrorChannelForwarding(() => false)
    const channel = await useErrorChannel()
    const sender = new BroadcastChannel('nuxt:dev:error')
    const current = async (requestId: string) => {
      const response = await channel.fetchHandler(new Request(`http://localhost/__nuxt_dev__/error/events?requestId=${requestId}`), { trusted: false })
      const reader = response!.body!.getReader()
      const { value } = await reader.read()
      await reader.cancel()
      return /"current":\{"id":"([^"]+)"/.exec(new TextDecoder().decode(value))?.[1]
    }

    sender.postMessage({ type: 'nuxt:dev:error:report', report, requestId: 'page-a' })
    await vi.waitFor(async () => expect(await current('page-a')).toBe(report.id))
    expect(await current('page-b')).toBeUndefined()
    sender.close()
  })

  it('applies problem sets another thread posts to an owned channel', async () => {
    setErrorChannelForwarding(() => false)
    const channel = await useErrorChannel()
    const sender = new BroadcastChannel('nuxt:dev:error')

    const meta = { label: 'vue-tsc', status: 'idle', url: '/_nuxt/__checker/?embed', devtoolsDock: 'vite-plugin-checker' } as const
    sender.postMessage({ type: 'nuxt:dev:error:problems', source: 'checker:vue-tsc', reports: [report], meta })
    await vi.waitFor(() => expect(channel.problems).toEqual([{ source: 'checker:vue-tsc', ...meta, reports: [report] }]))

    sender.postMessage({ type: 'nuxt:dev:error:problems:clear', source: 'checker:vue-tsc' })
    await vi.waitFor(() => expect(channel.problems).toEqual([]))
    sender.close()
  })

  it('tells pages of an owned channel that another thread registered a DevTools dock', async () => {
    setErrorChannelForwarding(() => false)
    const channel = await useErrorChannel()
    const sender = new BroadcastChannel('nuxt:dev:error')
    const hello = async () => {
      const response = await channel.fetchHandler(new Request('http://localhost/__nuxt_dev__/error/events'), { trusted: true })
      const reader = response!.body!.getReader()
      const { value } = await reader.read()
      await reader.cancel()
      return new TextDecoder().decode(value)
    }

    expect(await hello()).not.toContain('"devtools":true')
    sender.postMessage({ type: 'nuxt:dev:error:devtools', registered: true })
    await vi.waitFor(async () => expect(await hello()).toContain('"devtools":true'))
    sender.close()
  })

  it('forwards problem sets and DevTools registration to the owning dev server', async () => {
    setErrorChannelForwarding(() => true)
    const channel = await useErrorChannel()
    const messages: unknown[] = []
    const listener = new BroadcastChannel('nuxt:dev:error')
    listener.onmessage = event => messages.push(event.data)

    channel.setProblems('checker:vue-tsc', [report], { label: 'vue-tsc' })
    channel.clearProblems('checker:vue-tsc')
    channel.setDevTools(true)
    await vi.waitFor(() => expect(messages).toEqual([
      { type: 'nuxt:dev:error:problems', source: 'checker:vue-tsc', reports: [report], meta: { label: 'vue-tsc' } },
      { type: 'nuxt:dev:error:problems:clear', source: 'checker:vue-tsc' },
      { type: 'nuxt:dev:error:devtools', registered: true },
    ]))
    listener.close()
  })
})
