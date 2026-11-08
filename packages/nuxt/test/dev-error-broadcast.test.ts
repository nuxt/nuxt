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

  it('forwards problem sets to the owning dev server', async () => {
    setErrorChannelForwarding(() => true)
    const channel = await useErrorChannel()
    const messages: unknown[] = []
    const listener = new BroadcastChannel('nuxt:dev:error')
    listener.onmessage = event => messages.push(event.data)

    channel.setProblems('checker:vue-tsc', [report], { label: 'vue-tsc' })
    channel.clearProblems('checker:vue-tsc')
    await vi.waitFor(() => expect(messages).toEqual([
      { type: 'nuxt:dev:error:problems', source: 'checker:vue-tsc', reports: [report], meta: { label: 'vue-tsc' } },
      { type: 'nuxt:dev:error:problems:clear', source: 'checker:vue-tsc' },
    ]))
    listener.close()
  })
})
