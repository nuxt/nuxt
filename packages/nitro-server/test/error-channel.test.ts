import { afterEach, describe, expect, it, vi } from 'vitest'
import process from 'node:process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ErrorReport } from 'my-bad'

const { nitroApp } = vi.hoisted(() => ({ nitroApp: {} as Record<string, unknown> }))

vi.mock('nitro/app', () => ({ useNitroApp: () => nitroApp }))
vi.mock('#internal/nuxt/nitro-config.mjs', () => ({ NUXT_ERROR_CHANNEL: '/__nuxt_dev__/error' }))
const { paths } = vi.hoisted(() => ({ paths: { rootDir: '/app', srcDir: '/app/app' } }))
vi.mock('#internal/dev-server-logs-options', () => ({
  get rootDir () { return paths.rootDir },
  get srcDir () { return paths.srcDir },
}))
vi.mock('node:worker_threads', () => ({ isMainThread: false }))

const { ERROR_CHANNEL_BROADCAST, ERROR_CHANNEL_ENV, createErrorReport, getErrorChannelPath, publishDevLog, publishDevProgress, publishErrorReport, shouldForwardReports, useErrorChannel } = await import('../src/runtime/utils/error-channel.ts')

const report = { id: 'abc', kind: 'error', name: 'Error', message: 'boom', frames: [], causes: [], sections: [], timestamp: 0 } as ErrorReport

afterEach(() => {
  paths.srcDir = '/app/app'
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
  it('resolves a transform failure named by its module id to the file on disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nuxt-error-src-'))
    paths.srcDir = dir
    const file = join(dir, 'app.vue')
    await writeFile(file, '<template>\n  <div>hello</div>\n</template>\n')

    const error = Object.assign(new Error('Parse failed'), {
      id: '/app.vue',
      loc: { file: '/app.vue', line: 2, column: 3 },
      cause: Object.assign(new Error('nested'), { id: '/app.vue?vue&type=script' }),
    })
    const report = await createErrorReport(error)

    expect(report.frames[0]).toMatchObject({ file, line: 2, column: 3 })
    expect((error as { cause: { id: string } }).cause.id).toBe(`${file}?vue&type=script`)
  })

  it('leaves out a wrapper cause that only repeats the message and its code frame', async () => {
    const message = 'Parse failure: Expected `,` but found `!`'
    const error = Object.assign(new Error(message), {
      id: '/nope.vue',
      loc: { file: '/nope.vue', line: 1, column: 1 },
      cause: new Error(`${message}\n 7:     class: _ctx.bob !\n                     ^`),
    })

    expect((await createErrorReport(error)).causes).toEqual([])
  })

  it('keeps a cause that says something the report does not', async () => {
    const error = Object.assign(new Error('Parse failure'), { cause: new Error('Parse failure of a different kind') })

    expect((await createErrorReport(error)).causes).toHaveLength(1)
  })

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
  it('posts log entries to the owning dev server', async () => {
    process.env[ERROR_CHANNEL_ENV] = '/__nuxt_dev__/error'
    const received: any[] = []
    const listener = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
    listener.onmessage = event => received.push(event.data)

    await publishDevLog({ level: 'warn', text: 'careful' })
    await vi.waitFor(() => expect(received.some(message => message.type === 'nuxt:dev:error:log')).toBe(true))

    const logged = received.find(message => message.type === 'nuxt:dev:error:log')
    expect(logged.entry).toMatchObject({ level: 'warn', text: 'careful' })
    expect(typeof logged.entry.timestamp).toBe('number')

    listener.close()
    ;(await useErrorChannel()).close()
  })

  it('posts build progress to the owning dev server', async () => {
    process.env[ERROR_CHANNEL_ENV] = '/__nuxt_dev__/error'
    const received: any[] = []
    const listener = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
    listener.onmessage = event => received.push(event.data)

    await publishDevProgress({ phase: 'transform', message: 'Rebuilding' })
    await vi.waitFor(() => expect(received.some(message => message.type === 'nuxt:dev:error:progress')).toBe(true))

    expect(received.find(message => message.type === 'nuxt:dev:error:progress').progress).toEqual({ phase: 'transform', message: 'Rebuilding' })

    listener.close()
    ;(await useErrorChannel()).close()
  })

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
