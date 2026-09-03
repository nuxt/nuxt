import { describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { ViteDevServer } from 'vite'
import { DevErrorsPlugin, createDevErrorReporter, isTransformError } from '../src/dev-errors.ts'

const transformError = {
  message: 'Illegal \'/\' in tags.',
  plugin: 'vite:vue',
  id: '/src/app.vue',
  loc: { file: '/src/app.vue', line: 8, column: 4 },
  frame: '6  |    <div\n7  |      Nuxt Playground\n8  |    </div>\n   |      ^\n',
}

function createNuxt () {
  const hooks: Record<string, () => void> = {}
  return {
    options: { rootDir: '/src', app: { baseURL: '/' }, devServer: { errorChannel: '/__nuxt_dev__/error' } },
    hook: (name: string, fn: () => void) => { hooks[name] = fn },
    close: () => hooks.close?.(),
  } as unknown as Nuxt & { close: () => void }
}

function listen () {
  const messages: any[] = []
  const channel = new BroadcastChannel('nuxt:dev:error')
  channel.onmessage = event => messages.push(event.data)
  return { messages, channel }
}

describe('isTransformError', () => {
  it('recognises the shape vite gives its logger and hmr channel', () => {
    expect(isTransformError(transformError)).toBe(true)
    expect(isTransformError({ message: 'boom', loc: { line: 1, column: 1 } })).toBe(true)
    expect(isTransformError(new Error('boom'))).toBe(false)
    expect(isTransformError('boom')).toBe(false)
  })
})

describe('createDevErrorReporter', () => {
  it('reports a compile error once, to the channel and the terminal', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print })

    const report = await reporter.report(transformError)
    expect(await reporter.report({ ...transformError })).toBeUndefined()

    expect(report).toMatchObject({ kind: 'compile', frames: [{ file: '/src/app.vue', line: 8, column: 4 }] })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0]).toEqual({ type: 'nuxt:dev:error:report', report })
    expect(print).toHaveBeenCalledTimes(1)
    expect(print.mock.calls[0]![0]).toContain('Illegal')

    channel.close()
    nuxt.close()
  })

  it('leaves printing to a dev server that owns the channel', async () => {
    vi.stubEnv('NUXT_DEV_ERROR_CHANNEL', '/__nuxt_dev__/error')
    const nuxt = createNuxt()
    const print = vi.fn()
    const reporter = createDevErrorReporter(nuxt, { print })

    await reporter.report(transformError)
    expect(print).not.toHaveBeenCalled()

    vi.unstubAllEnvs()
    nuxt.close()
  })

  it('pushes the overlay to open pages over the hmr channel, and clears it', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const send = vi.fn()
    reporter.attach({ environments: { client: { hot: { send } } } } as unknown as ViteDevServer)

    const report = await reporter.report(transformError)
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    const [payload] = send.mock.calls[0]! as [{ type: string, event: string, data: { id: string, html: string } }]
    expect(payload).toMatchObject({ type: 'custom', event: 'nuxt:dev:error', data: { id: report!.id } })
    expect(payload.data.html).toContain('<nuxt-error-overlay>')
    expect(payload.data.html).toContain('"channel":"/__nuxt_dev__/error"')
    expect(payload.data.html).toContain('"startMinimized":true')

    reporter.clear()
    expect(send).toHaveBeenLastCalledWith({ type: 'custom', event: 'nuxt:dev:error:clear' })
    nuxt.close()
  })

  it('repeats the current report to a channel that starts listening late, and clears it', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const report = await reporter.report(transformError)

    const { messages, channel } = listen()
    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0]).toEqual({ type: 'nuxt:dev:error:report', report })

    reporter.clear()
    reporter.clear()
    await vi.waitFor(() => expect(messages).toHaveLength(2))
    expect(messages[1]).toEqual({ type: 'nuxt:dev:error:clear' })

    channel.close()
    nuxt.close()
  })
})

/** A client module graph holding one transformed module, as the browser loaded it. */
function clientGraph () {
  const mod = {
    id: '/src/pages/index.vue',
    file: '/src/pages/index.vue',
    // the module's own first line is the third line of what the browser ran
    transformResult: { code: 'import x\nimport y\nthrow new Error("boom")\n', map: { version: 3, names: [], sources: ['/src/pages/index.vue'], mappings: ';;AACA' } },
  }
  return {
    urlToModuleMap: new Map([['/pages/index.vue', mod]]),
    getModuleById: (id: string) => id === mod.id ? mod : undefined,
    getModulesByFile: (file: string) => file === mod.file ? new Set([mod]) : undefined,
  }
}

describe('createDevErrorReporter (runtime errors from the browser)', () => {
  it('reports an error the browser raised, with its stack resolved to source', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print })
    const send = vi.fn()
    const listeners: Record<string, (data: any) => void> = {}
    reporter.attach({
      config: { base: '/_nuxt/' },
      environments: { client: { hot: { send, on: (event: string, fn: (data: any) => void) => { listeners[event] = fn } }, moduleGraph: clientGraph() } },
    } as unknown as ViteDevServer)

    // the browser loaded the module under the bundler's base
    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'boom', stack: 'Error: boom\n    at setup (http://localhost:3000/_nuxt/pages/index.vue?t=1:3:1)' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))

    expect(reporter.isRuntime).toBe(true)
    expect(messages[0].report).toMatchObject({
      name: 'Error',
      message: 'boom',
      frames: [{ function: 'setup', file: '/src/pages/index.vue', line: 2, compiled: { line: 3 } }],
    })
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    // the app is left half-rendered, so the page starts over on clear
    expect(send.mock.calls[0]![0]).toMatchObject({ type: 'custom', event: 'nuxt:dev:error', data: { reloadOnClear: true } })
    expect(print).toHaveBeenCalledTimes(1)

    channel.close()
    nuxt.close()
  })

  it('replays the overlay when a page connects, and when it reloads into the same error', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const reporter = createDevErrorReporter(nuxt, { print })
    const send = vi.fn()
    const listeners: Record<string, (data?: any) => void> = {}
    reporter.attach({
      config: { base: '/_nuxt/' },
      environments: { client: { hot: { send, on: (event: string, fn: (data?: any) => void) => { listeners[event] = fn } }, moduleGraph: clientGraph() } },
    } as unknown as ViteDevServer)

    const error = { name: 'Error', message: 'boom', stack: 'Error: boom\n    at setup (http://localhost:3000/_nuxt/pages/index.vue?t=1:3:1)' }
    listeners['nuxt:dev:client-error']!(error)
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))

    listeners['vite:client:connect']!()
    expect(send).toHaveBeenCalledTimes(2)
    listeners['nuxt:dev:client-error']!({ ...error })
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(3))
    expect(new Set(send.mock.calls.map(([payload]) => JSON.stringify(payload))).size).toBe(1)
    expect(print).toHaveBeenCalledTimes(1)

    reporter.clear()
    listeners['vite:client:connect']!()
    expect(send).toHaveBeenLastCalledWith({ type: 'custom', event: 'nuxt:dev:error:clear' })
    nuxt.close()
  })

  it('reports the same error once', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const reporter = createDevErrorReporter(nuxt, { print })
    const listeners: Record<string, (data: any) => void> = {}
    reporter.attach({
      config: { base: '/_nuxt/' },
      environments: { client: { hot: { send: vi.fn(), on: (event: string, fn: (data: any) => void) => { listeners[event] = fn } }, moduleGraph: clientGraph() } },
    } as unknown as ViteDevServer)

    const error = { name: 'Error', message: 'boom', stack: 'Error: boom\n    at setup (http://localhost:3000/_nuxt/pages/index.vue?t=1:3:1)' }
    listeners['nuxt:dev:client-error']!(error)
    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    listeners['nuxt:dev:client-error']!({ ...error })
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(print).toHaveBeenCalledTimes(1)
    nuxt.close()
  })
})

describe('createDevErrorReporter (errors reported elsewhere)', () => {
  it('clears a runtime error the server reported, which has no file to fix', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { messages, channel } = listen()
    const serverReport = { id: 'from-server', kind: 'error', name: 'HTTPError', message: 'hi', frames: [], causes: [], sections: [], timestamp: 0 }
    channel.postMessage({ type: 'nuxt:dev:error:report', report: serverReport })
    await vi.waitFor(() => expect(reporter.isRuntime).toBe(true))

    expect(reporter.file).toBeUndefined()
    reporter.clear()
    await vi.waitFor(() => expect(messages.some(message => message.type === 'nuxt:dev:error:clear')).toBe(true))
    expect(reporter.isRuntime).toBe(false)

    channel.close()
    nuxt.close()
  })

  it('remembers the file from a compile error the server reported, so fixing it clears', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { messages, channel } = listen()
    const serverReport = {
      id: 'from-server', kind: 'error', name: 'HTTPError', message: 'x', frames: [], sections: [], timestamp: 0,
      causes: [{ id: 'c', kind: 'compile', name: 'SyntaxError', message: 'x', frames: [{ type: 'app', file: '/src/pages/broken.vue', line: 3, column: 1 }], causes: [], sections: [], timestamp: 0 }],
    }
    channel.postMessage({ type: 'nuxt:dev:error:report', report: serverReport })
    await vi.waitFor(() => expect(reporter.file).toBe('/src/pages/broken.vue'))

    reporter.clear()
    await vi.waitFor(() => expect(messages.some(message => message.type === 'nuxt:dev:error:clear')).toBe(true))
    expect(reporter.file).toBeUndefined()

    channel.close()
    nuxt.close()
  })
})

describe('DevErrorsPlugin', () => {
  function hotUpdate (reporter: any, file: string, transform: () => Promise<unknown>) {
    const plugin = DevErrorsPlugin(reporter)
    const hook = plugin.hotUpdate as unknown as (this: { environment: { name: string, transformRequest: () => Promise<unknown> } }, options: { file: string }) => void
    hook.call({ environment: { name: 'client', transformRequest: transform } }, { file })
  }

  it('transforms the file that failed once it changes, clearing the report when it compiles', async () => {
    const reporter = { report: vi.fn(() => Promise.resolve(undefined)), clear: vi.fn(), file: '/src/app.vue' }
    const transform = vi.fn(() => Promise.resolve({}))

    hotUpdate(reporter, '/src/app.vue', transform)
    await vi.waitFor(() => expect(reporter.clear).toHaveBeenCalledTimes(1))
    expect(transform).toHaveBeenCalledWith('/src/app.vue')
  })

  it('reports the file again when it still fails', async () => {
    const reporter = { report: vi.fn(() => Promise.resolve(undefined)), clear: vi.fn(), file: '/src/app.vue' }

    hotUpdate(reporter, '/src/app.vue', () => Promise.reject(transformError))
    await vi.waitFor(() => expect(reporter.report).toHaveBeenCalledWith(transformError))
    expect(reporter.clear).not.toHaveBeenCalled()
  })

  it('clears a runtime error on any update, since the page reports it again', () => {
    const reporter = { report: vi.fn(), clear: vi.fn(), file: undefined, isRuntime: true }

    hotUpdate(reporter, '/src/other.vue', () => Promise.resolve({}))
    expect(reporter.clear).toHaveBeenCalledTimes(1)
  })

  it('leaves other files and files that compile to vite', async () => {
    const transform = vi.fn(() => Promise.resolve({}))

    hotUpdate({ report: vi.fn(), clear: vi.fn(), file: undefined }, '/src/app.vue', transform)
    hotUpdate({ report: vi.fn(), clear: vi.fn(), file: '/src/app.vue' }, '/src/other.vue', transform)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(transform).not.toHaveBeenCalled()
  })

  it('transforms once per change even when several environments see it', async () => {
    const reporter = { report: vi.fn(), clear: vi.fn(), file: '/src/app.vue' }
    const plugin = DevErrorsPlugin(reporter as any)
    const hook = plugin.hotUpdate as unknown as (this: { environment: { name: string, transformRequest: () => Promise<unknown> } }, options: { file: string }) => void
    const transform = vi.fn(() => new Promise(resolve => setTimeout(resolve, 20)))
    for (const name of ['client', 'ssr', 'nitro']) {
      hook.call({ environment: { name, transformRequest: transform } }, { file: '/src/app.vue' })
    }
    await vi.waitFor(() => expect(reporter.clear).toHaveBeenCalledTimes(1))
    expect(transform).toHaveBeenCalledTimes(1)
  })
})
