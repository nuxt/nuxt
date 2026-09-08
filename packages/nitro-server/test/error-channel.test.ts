import { afterEach, describe, expect, it, vi } from 'vitest'
import process from 'node:process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ErrorReport } from 'my-bad'

const { nitroApp } = vi.hoisted(() => ({ nitroApp: {} as Record<string, unknown> }))

vi.mock('nitro/app', () => ({ useNitroApp: () => nitroApp }))
vi.mock('#internal/nuxt/nitro-config.mjs', () => ({ NUXT_ERROR_CHANNEL: '/__nuxt_dev__/error' }))
vi.mock('#internal/dev-server-logs-options', () => ({ rootDir: '/app' }))
vi.mock('node:worker_threads', () => ({ isMainThread: false }))

const { ERROR_CHANNEL_BROADCAST, ERROR_CHANNEL_ENV, createErrorReport, getErrorChannelPath, publishErrorReport, shouldForwardReports, useErrorChannel } = await import('../src/runtime/utils/error-channel.ts')

const report = { id: 'abc', kind: 'error', name: 'Error', message: 'boom', frames: [], causes: [], sections: [], timestamp: 0 } as ErrorReport

afterEach(() => {
  delete nitroApp.ssrSourceMaps
  delete process.env[ERROR_CHANNEL_ENV]
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('nuxt:dev:error-channel')]
})

describe('shouldForwardReports', () => {
  it('forwards only from a worker thread of a dev server that owns the channel', () => {
    expect(shouldForwardReports({ [ERROR_CHANNEL_ENV]: '/__nuxt_dev__/error' }, false)).toBe(true)
    expect(shouldForwardReports({ [ERROR_CHANNEL_ENV]: '/__nuxt_dev__/error' }, true)).toBe(false)
    expect(shouldForwardReports({}, false)).toBe(false)
    expect(shouldForwardReports({ [ERROR_CHANNEL_ENV]: '' }, false)).toBe(false)
  })
})

describe('getErrorChannelPath', () => {
  it('prefers the path the dev server in front actually mounted', () => {
    expect(getErrorChannelPath()).toBe('/__nuxt_dev__/error')
    process.env[ERROR_CHANNEL_ENV] = '/custom/errors'
    expect(getErrorChannelPath()).toBe('/custom/errors')
  })
})

describe('createErrorReport', () => {
  it('recovers the compiled position of frames whose stack is already mapped', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nuxt-error-report-'))
    const file = join(dir, 'useBoom.ts')
    await writeFile(file, 'export function useBoom () {\n  throw new Error("boom")\n}\n')
    const code = 'const wrapper = 1\nconst wrapper2 = 2\nexport function useBoom () {\n  throw new Error("boom")\n}\n'
    nitroApp.ssrSourceMaps = {
      stacksAreMapped: true,
      getCode: () => code,
      getCompiledPosition: (position: string, line: number, column?: number) => position === file ? { file, line: line + 2, column: column ?? 1 } : undefined,
    }

    const error = Object.assign(new Error('boom'), { stack: `Error: boom\n    at useBoom (${file}:2:9)` })
    const report = await createErrorReport(error)

    expect(report.frames[0]).toMatchObject({ file, line: 2, column: 9, compiled: { file, line: 4, column: 9 } })
    expect(report.frames[0]!.snippet?.lines).toContain('  throw new Error("boom")')
    expect(report.frames[0]!.compiled?.snippet?.lines).toContain('const wrapper2 = 2')
  })
})

describe('forwarding channel', () => {
  it('posts reports, paired with the request, to the owning dev server', async () => {
    process.env[ERROR_CHANNEL_ENV] = '/__nuxt_dev__/error'
    const received: unknown[] = []
    const listener = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
    listener.onmessage = event => received.push(event.data)

    const event = { req: { method: 'GET', headers: new Headers({ 'x-nuxt-dev-request-id': '42' }) }, url: new URL('http://localhost/ok?a=1') } as any
    await publishErrorReport(report, event)
    await publishErrorReport(report)
    const channel = await useErrorChannel()
    channel.clearError('abc')
    await vi.waitFor(() => expect(received).toHaveLength(3))

    expect(received).toEqual([
      { type: 'nuxt:dev:error:report', report, requestId: 42, request: 'GET /ok?a=1' },
      { type: 'nuxt:dev:error:report', report, requestId: undefined, request: undefined },
      { type: 'nuxt:dev:error:clear', id: 'abc' },
    ])
    expect(channel.current).toBeUndefined()
    expect(await channel.fetchHandler(new Request('http://localhost/__nuxt_dev__/error/events'))).toBeUndefined()

    listener.close()
    channel.close()
  })
})
