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
