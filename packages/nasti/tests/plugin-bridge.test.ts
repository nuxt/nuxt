import type { Plugin as VitePlugin } from 'vite'
import { logger } from '@nuxt/kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bridgeVitePlugins, flattenVitePlugins, toNastiPlugin } from '../src/plugin-bridge.ts'

beforeEach(() => {
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.info).mockClear()
})

describe('flattenVitePlugins', () => {
  it('flattens nested arrays and awaits promise entries', async () => {
    const a = { name: 'a' }
    const b = { name: 'b' }
    const c = { name: 'c' }

    const flat = await flattenVitePlugins([a, [b, Promise.resolve(c)]] as any)

    expect(flat.map(p => p.name)).toEqual(['a', 'b', 'c'])
  })

  it('drops falsy entries and objects without a name', async () => {
    const named = { name: 'named' }

    const flat = await flattenVitePlugins([null, false, undefined, { transform () {} }, named] as any)

    expect(flat.map(p => p.name)).toEqual(['named'])
  })

  it('returns the accumulator unchanged for a falsy input', async () => {
    const acc: VitePlugin[] = []
    expect(await flattenVitePlugins(undefined, acc)).toBe(acc)
    expect(acc).toHaveLength(0)
  })
})

describe('toNastiPlugin', () => {
  function bridge (plugin: Record<string, unknown>) {
    const dropped = new Map<string, Set<string>>()
    const out = toNastiPlugin(plugin as unknown as VitePlugin, dropped)
    return { out, dropped }
  }

  it('copies name, enforce and a string/function apply', () => {
    const { out } = bridge({ name: 'p', enforce: 'pre', apply: 'build' })
    expect(out.name).toBe('p')
    expect(out.enforce).toBe('pre')
    expect(out.apply).toBe('build')
  })

  it('names anonymous plugins `<anonymous>`', () => {
    const { out } = bridge({})
    expect(out.name).toBe('<anonymous>')
  })

  it('does not copy an object-form `apply`', () => {
    const { out } = bridge({ name: 'p', apply: { command: 'build' } })
    expect(out.apply).toBeUndefined()
  })

  it('forwards passthrough hooks 1:1', () => {
    const transform = vi.fn()
    const { out, dropped } = bridge({ name: 'p', transform })
    expect(out.transform).toBe(transform)
    expect(dropped.size).toBe(0)
  })

  it('unwraps the Vite object-hook `{ handler }` form to a bare function', () => {
    const handler = vi.fn()
    const { out } = bridge({ name: 'p', transform: { order: 'pre', handler } })
    expect(out.transform).toBe(handler)
  })

  it('passes only `html` to a bridged transformIndexHtml (drops the ctx arg)', () => {
    const handler = vi.fn()
    const { out } = bridge({ name: 'p', transformIndexHtml: handler })

    ;(out.transformIndexHtml as (html: string, ctx?: unknown) => unknown)('<html>', { server: {} })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]).toEqual(['<html>'])
  })

  it('records a passthrough hook whose value is not a function', () => {
    const { out, dropped } = bridge({ name: 'p', transform: 'not-a-function' })
    expect(out.transform).toBeUndefined()
    expect(dropped.get('p')).toEqual(new Set(['transform']))
  })

  it('records Vite-only hooks Nasti has no slot for', () => {
    const { dropped } = bridge({ name: 'p', options () {}, hotUpdate () {}, renderStart () {} })
    expect(dropped.get('p')).toEqual(new Set(['options', 'hotUpdate', 'renderStart']))
  })

  it('forwards buildEnd rather than dropping it', () => {
    const buildEnd = vi.fn()
    const { out, dropped } = bridge({ name: 'p', buildEnd })
    expect(out.buildEnd).toBe(buildEnd)
    expect(dropped.has('p')).toBe(false)
  })
})

describe('bridgeVitePlugins', () => {
  it('bridges every plugin and logs the count', async () => {
    const bridged = await bridgeVitePlugins([{ name: 'a' }, { name: 'b' }] as any)

    expect(bridged.map(p => p.name)).toEqual(['a', 'b'])
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('bridged 2 Vite plugin(s)'),
    )
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })

  it('emits a single summary warning listing the dropped hooks', async () => {
    await bridgeVitePlugins([{ name: 'with-gaps', options () {}, hotUpdate () {} }] as any)

    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1)
    const warning = vi.mocked(logger.warn).mock.calls[0]![0] as string
    expect(warning).toContain('could not forward some Vite plugin hooks')
    expect(warning).toContain('with-gaps:')
    expect(warning).toContain('options')
    expect(warning).toContain('hotUpdate')
  })

  it('keeps the dropped tally request-local across calls', async () => {
    await bridgeVitePlugins([{ name: 'first', options () {} }] as any)
    vi.mocked(logger.warn).mockClear()

    await bridgeVitePlugins([{ name: 'second', hotUpdate () {} }] as any)

    const warning = vi.mocked(logger.warn).mock.calls[0]![0] as string
    expect(warning).toContain('second:')
    expect(warning).not.toContain('first')
  })
})
