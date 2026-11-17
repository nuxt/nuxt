import { describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { NitroApp } from 'nitro/types'

const { flags } = vi.hoisted(() => ({ flags: { legacyCompat: false } }))

vi.mock('nitro', () => ({ definePlugin: (plugin: unknown) => plugin }))
vi.mock('#nuxt-compat/flags', () => ({
  get legacyCompat () { return flags.legacyCompat },
}))

async function setup (legacyCompat: boolean) {
  flags.legacyCompat = legacyCompat
  vi.resetModules()
  const { serverDiagnostics } = await import('../src/runtime/diagnostics.ts')
  const report = vi.spyOn(serverDiagnostics, 'NUXT_E8013').mockImplementation(() => ({}) as any)
  const { default: plugin } = await import('../src/runtime/plugins/dev-hooks.ts')
  const hooks = createHooks<Record<string, () => void>>()
  ;(plugin as (app: NitroApp) => void)({ hooks } as unknown as NitroApp)
  return { hooks, report, reported: () => report.mock.calls.map(([params]) => (params as { hook: string }).hook) }
}

describe('dev hooks plugin', () => {
  it('reports listeners for Nitro v2 hooks that are not emitted', async () => {
    const { hooks, report, reported } = await setup(false)
    const listener = vi.fn()
    hooks.hook('render:before', listener)
    hooks.hook('render:before', () => {})
    hooks.hookOnce('beforeResponse', () => {})
    hooks.hook('render:response', () => {})
    hooks.hook('render:html', () => {})
    hooks.hook('response', () => {})
    expect(reported()).toEqual(['render:before', 'beforeResponse', 'render:response'])
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ location: expect.stringMatching(/test[\\/]dev-hooks-plugin\.test\.ts$/) }))

    await hooks.callHook('render:before')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('leaves the hooks the compatibility layer bridges alone when it is active', async () => {
    const { hooks, reported } = await setup(true)
    hooks.hook('beforeResponse', () => {})
    hooks.hook('render:response', () => {})
    hooks.hook('render:before', () => {})
    expect(reported()).toEqual(['render:before'])
  })
})
