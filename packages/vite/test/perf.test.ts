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

  it('should run timed hooks with the plugin context from `timeBundlerHook`', () => {
    const recorded: unknown[] = []
    const timedCtx = { id: 'timed' }
    const timeBundlerHook = (name: string, hook: string, ctx: unknown, run: (ctx: unknown) => unknown) => {
      recorded.push([name, hook, ctx])
      return run(timedCtx)
    }
    const plugin = { name: 'test-plugin', resolveId (this: unknown) { return this } }
    applyPerfPlugin(createNuxt({}, { timeBundlerHook } as any), [plugin as Plugin])

    const ctx = { id: 'ctx' }
    expect(plugin.resolveId.call(ctx)).toBe(timedCtx)
    expect(recorded).toEqual([['test-plugin', 'resolveId', ctx]])
  })

  it('should time frozen object hooks through a copy and leave frozen plugins untimed', () => {
    const recorded: string[] = []
    const timeBundlerHook = (name: string, hook: string, ctx: unknown, run: (ctx: unknown) => unknown) => {
      recorded.push(`${name}:${hook}`)
      return run(ctx)
    }
    const filter = { id: /\.ts$/ }
    const plugin = { name: 'object-hook', transform: Object.freeze({ filter, order: 'pre' as const, handler: (code: string) => code + '!' }) }
    const frozen = Object.freeze({ name: 'frozen', load: (id: string) => id })
    const { load } = frozen
    applyPerfPlugin(createNuxt({}, { timeBundlerHook } as any), [plugin, frozen])

    expect(plugin.transform.handler('code')).toBe('code!')
    expect(plugin.transform).toMatchObject({ filter, order: 'pre' })
    expect(frozen.load).toBe(load)
    expect(recorded).toEqual(['object-hook:transform'])
  })

  it('should keep changes a plugin makes to its hook objects after wrapping', () => {
    const recorded: string[] = []
    const timeBundlerHook = (name: string, hook: string, ctx: unknown, run: (ctx: unknown) => unknown) => {
      recorded.push(`${name}:${hook}`)
      return run(ctx)
    }
    const plugin = { name: 'filtered', load: { filter: { id: /\.ts$/ } as { id: RegExp } | undefined, handler: (id: string) => id } }
    const copy = { ...plugin }
    applyPerfPlugin(createNuxt({}, { timeBundlerHook } as any), [copy])

    delete plugin.load.filter
    expect(copy.load).not.toHaveProperty('filter')
    expect(copy.load.handler('/a.ts')).toBe('/a.ts')
    expect(recorded).toEqual(['filtered:load'])
  })

  it('should time each handler once when plugins share hooks', () => {
    const recorded: string[] = []
    const timeBundlerHook = (name: string, hook: string, ctx: unknown, run: (ctx: unknown) => unknown) => {
      recorded.push(`${name}:${hook}`)
      return run(ctx)
    }
    const plugin = { name: 'shared', resolveId: (id: string) => id, load: { handler: (id: string) => id } }
    const perf = applyPerfPlugin(createNuxt({}, { timeBundlerHook } as any), [plugin, { ...plugin }])
    const copy = { ...plugin }
    const ssr = { name: 'ssr', plugins: [copy], fetchModule: () => Promise.resolve({}) }
    ;(perf.configureServer as (server: unknown) => void)({ environments: { ssr } })
    ;(perf.buildStart as (this: unknown) => void).call({ environment: ssr })

    copy.resolveId('/a.ts')
    copy.load.handler('/b.ts')
    expect(recorded).toEqual(['shared:resolveId', 'shared:load'])
  })

  it('should time a hook object shared between hooks and plugins under each name', () => {
    const recorded: string[] = []
    const timeBundlerHook = (name: string, hook: string, ctx: unknown, run: (ctx: unknown) => unknown) => {
      recorded.push(`${name}:${hook}`)
      return run(ctx)
    }
    const hook = { handler: () => null }
    const first = { name: 'first', resolveId: hook, load: hook }
    const second = { name: 'second', load: hook }
    applyPerfPlugin(createNuxt({}, { timeBundlerHook } as any), [first, second])

    first.resolveId.handler()
    first.load.handler()
    second.load.handler()
    expect(recorded).toEqual(['first:resolveId', 'first:load', 'second:load'])
  })

  it('should mark a phase for each environment the builder builds', async () => {
    const phases: string[] = []
    const perf = { startPhase: (name: string) => phases.push(`start ${name}`), endPhase: (name: string) => phases.push(`end ${name}`) }
    const builder = {
      build: (environment: { name: string }) => environment.name === 'nitro' ? Promise.reject(new Error('failed')) : Promise.resolve(environment.name),
    }
    const plugin = PerfPlugin(createNuxt({}, perf as any)) as { buildApp?: { handler: (builder: unknown) => Promise<void> } }
    await plugin.buildApp?.handler(builder)

    expect(await builder.build({ name: 'client' })).toBe('client')
    await expect(builder.build({ name: 'nitro' })).rejects.toThrow('failed')
    expect(phases).toEqual(['start vite:client', 'end vite:client', 'start vite:nitro'])
  })

  it('should publish server module fetches on `nuxt.bundler.module`', async () => {
    const events = subscribe('nuxt.bundler.module')
    const ssr = { name: 'ssr', plugins: [], fetchModule: (id: string) => Promise.resolve({ code: id }) }
    const client = { name: 'client', plugins: [], fetchModule: (id: string) => Promise.resolve({ code: id }) }
    const perf = PerfPlugin(createNuxt({ tracingChannel: { nuxt: true } } as any))
    ;(perf.configureServer as (server: unknown) => void)({ environments: { ssr, client } })
    expect(await ssr.fetchModule('/c.ts')).toEqual({ code: '/c.ts' })
    await client.fetchModule('/d.ts')
    expect(events).toEqual([
      ['start', { url: '/c.ts', environment: 'ssr', result: undefined }],
      ['asyncEnd', { code: '/c.ts' }],
    ])
  })

  it('should trace plugins resolved per environment', async () => {
    const events = subscribe('nuxt.bundler.plugin')
    const plugin: Plugin = { name: 'env-plugin', load: id => id }
    const perf = applyPerfPlugin(createNuxt({ tracingChannel: { nuxt: true } } as any), [])
    const ssr = { name: 'ssr', plugins: [plugin], fetchModule: () => Promise.resolve({}) }
    ;(perf.configureServer as (server: unknown) => void)({ environments: { ssr } })
    await (plugin.load as any).call({ environment: ssr }, '/e.ts')
    expect(events[0]).toEqual(['start', { plugin: 'env-plugin', hook: 'load', id: '/e.ts', environment: 'ssr', result: undefined }])
  })
})
