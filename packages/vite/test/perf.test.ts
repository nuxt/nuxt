import { tracingChannel } from 'node:diagnostics_channel'
import { afterEach, describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin, ResolvedConfig } from 'vite'
import { PerfPlugin } from '../src/plugins/perf.ts'

function subscribe (name: string) {
  const events: Array<[string, unknown]> = []
  const handlers = {
    start: (ctx: any) => { events.push(['start', { ...ctx, result: undefined }]) },
    asyncEnd: (ctx: any) => { events.push(['asyncEnd', ctx.result]) },
  }
  const channel = tracingChannel(name)
  channel.subscribe(handlers as any)
  cleanups.push(() => channel.unsubscribe(handlers as any))
  return events
}

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) { cleanup() }
})

function createNuxt (options: Partial<Nuxt['options']> = {}, perf?: Nuxt['_perf']) {
  return { options, _perf: perf } as unknown as Nuxt
}

function applyPerfPlugin (nuxt: Nuxt, plugins: Plugin[]) {
  const perf = PerfPlugin(nuxt)
  ;(perf.configResolved as (config: ResolvedConfig) => void)({ plugins } as unknown as ResolvedConfig)
  return perf
}

describe('PerfPlugin', () => {
  it('should publish plugin hook calls on `nuxt.bundler.plugin`', async () => {
    const events = subscribe('nuxt.bundler.plugin')
    const plugin: Plugin = {
      name: 'test-plugin',
      transform: { handler: (code: string) => code + '!' },
      load: id => `// ${id}`,
    }
    applyPerfPlugin(createNuxt({ tracingChannel: { nuxt: true } } as any), [plugin])

    const ctx = { environment: { name: 'ssr' } }
    expect(await (plugin.transform as any).handler.call(ctx, 'code', '/a.ts')).toBe('code!')
    expect(await (plugin.load as any).call(ctx, '/b.ts')).toBe('// /b.ts')
    expect(events).toEqual([
      ['start', { plugin: 'test-plugin', hook: 'transform', id: '/a.ts', environment: 'ssr', result: undefined }],
      ['asyncEnd', 'code!'],
      ['start', { plugin: 'test-plugin', hook: 'load', id: '/b.ts', environment: 'ssr', result: undefined }],
      ['asyncEnd', '// /b.ts'],
    ])
  })

  it('should keep recording perf timings', () => {
    const recorded: string[] = []
    const plugin: Plugin = { name: 'test-plugin', resolveId: id => id }
    applyPerfPlugin(createNuxt({}, { recordBundlerPluginHook: (name: string, hook: string) => recorded.push(`${name}:${hook}`) } as any), [plugin])
    expect((plugin.resolveId as any).call({}, 'x')).toBe('x')
    expect(recorded).toEqual(['test-plugin:resolveId'])
  })

  it('should publish server module fetches on `nuxt.bundler.module`', async () => {
    const events = subscribe('nuxt.bundler.module')
    const ssr = { name: 'ssr', fetchModule: (id: string) => Promise.resolve({ code: id }) }
    const client = { name: 'client', fetchModule: (id: string) => Promise.resolve({ code: id }) }
    const perf = PerfPlugin(createNuxt({ tracingChannel: { nuxt: true } } as any))
    ;(perf.configureServer as (server: unknown) => void)({ environments: { ssr, client } })
    expect(await ssr.fetchModule('/c.ts')).toEqual({ code: '/c.ts' })
    await client.fetchModule('/d.ts')
    expect(events).toEqual([
      ['start', { id: '/c.ts', environment: 'ssr', result: undefined }],
      ['asyncEnd', { code: '/c.ts' }],
    ])
  })
})
