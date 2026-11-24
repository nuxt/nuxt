import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import { consola } from 'consola'
import type { NitroApp } from 'nitro/types'

const hooks = createHooks<Record<string, (...args: any[]) => any>>()

vi.mock('nitro', () => ({ definePlugin: (plugin: unknown) => plugin }))
vi.mock('nitro/app', () => ({ useNitroHooks: () => hooks }))
vi.mock('nitro/h3', () => ({
  toRequest: (input: Request | URL | string, init?: RequestInit) => input instanceof Request ? input : new Request(input, init),
}))
vi.mock('#internal/dev-server-logs-options', () => ({ rootDir: '/app' }))

setFlagsFromString('--expose_gc')
const gc = runInNewContext('gc') as () => void

afterEach(() => {
  hooks.removeAllHooks()
  vi.restoreAllMocks()
})

describe('dev server logs plugin', () => {
  it('retains the request log context across GC while a streamed response finishes', async () => {
    const reporters: Array<{ log: (entry: any) => void }> = []
    vi.spyOn(consola, 'addReporter').mockImplementation((reporter) => {
      reporters.push(reporter as any)
      return consola
    })
    vi.spyOn(consola, 'wrapConsole').mockImplementation(() => {})

    vi.resetModules()
    const { default: plugin } = await import('../src/runtime/plugins/dev-server-logs.ts')

    let resolveStream!: () => void
    const streamGate = new Promise<void>((resolve) => { resolveStream = resolve })
    const closeContext = { bodyAppend: [] as string[] }

    const nitroApp = {
      fetch: () => Promise.resolve(new Response(new ReadableStream({
        async start (controller) {
          await streamGate
          reporters[0]!.log({ type: 'warn', level: 1, args: ['logged during streamed render'] })
          await hooks.callHook('render:html:close', closeContext)
          controller.enqueue(new TextEncoder().encode(closeContext.bodyAppend.join('')))
          controller.close()
        },
      }))),
    } as unknown as NitroApp

    ;(plugin as (app: NitroApp) => void)(nitroApp)

    const response = await nitroApp.fetch(new Request('http://127.0.0.1/dev-logs'))
    await new Promise(resolve => setTimeout(resolve, 10))
    gc()
    await new Promise(resolve => setTimeout(resolve, 10))
    gc()

    resolveStream()
    const html = await response.text()

    expect(html).toContain('data-nuxt-logs=')
    expect(html).toContain('logged during streamed render')
  })
})
