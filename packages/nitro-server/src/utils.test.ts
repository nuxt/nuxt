import { describe, expect, it, vi } from 'vitest'
import type { PluginContext, ResolveIdResult } from 'rollup'
import { getLayerNodeModulesExcludePattern, nitroRuntimeResolvePlugin } from './utils.ts'

function callResolveId (plugin: ReturnType<typeof nitroRuntimeResolvePlugin>, id: string, ctx: Partial<PluginContext> = {}): Promise<ResolveIdResult> {
  const handler = typeof plugin.resolveId === 'function' ? plugin.resolveId : plugin.resolveId!.handler
  return handler.call({ resolve: vi.fn().mockResolvedValue(null), ...ctx } as unknown as PluginContext, id, undefined, {} as any) as Promise<ResolveIdResult>
}

describe('getLayerNodeModulesExcludePattern', () => {
  it('falls back to a bare node_modules pattern when no layers live in node_modules', () => {
    const re = getLayerNodeModulesExcludePattern(['/proj/'])
    expect(re.test('/proj/node_modules/anything/x.ts')).toBe(true)
    expect(re.test('/proj/app/x.ts')).toBe(false)
  })

  it('does not exclude files belonging to a flat-installed layer', () => {
    const re = getLayerNodeModulesExcludePattern(['/proj/node_modules/foo/'])
    expect(re.test('/proj/node_modules/foo/server/api/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/other/x.ts')).toBe(true)
  })

  it('does not exclude files belonging to layers nested inside another layer (npm)', () => {
    const re = getLayerNodeModulesExcludePattern([
      '/proj/node_modules/a/',
      '/proj/node_modules/a/node_modules/b/',
    ])
    expect(re.test('/proj/node_modules/a/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/a/node_modules/b/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/a/node_modules/other/x.ts')).toBe(true)
    expect(re.test('/proj/node_modules/other/x.ts')).toBe(true)
  })

  it('does not exclude files belonging to a layer installed via pnpm', () => {
    const re = getLayerNodeModulesExcludePattern([
      '/proj/node_modules/.pnpm/foo@1/node_modules/foo/',
    ])
    expect(re.test('/proj/node_modules/.pnpm/foo@1/node_modules/foo/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/.pnpm/other@1/node_modules/other/x.ts')).toBe(true)
    expect(re.test('/proj/node_modules/other/x.ts')).toBe(true)
  })

  it('protects every node_modules boundary in a pnpm layer path', () => {
    const re = getLayerNodeModulesExcludePattern([
      '/proj/node_modules/.pnpm/foo@1/node_modules/foo/',
    ])
    expect(re.source).toContain('.pnpm')
  })

  it('handles multiple pnpm-installed layers', () => {
    const re = getLayerNodeModulesExcludePattern([
      '/proj/node_modules/.pnpm/foo@1/node_modules/foo/',
      '/proj/node_modules/.pnpm/bar@1/node_modules/bar/',
    ])
    expect(re.test('/proj/node_modules/.pnpm/foo@1/node_modules/foo/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/.pnpm/bar@1/node_modules/bar/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/.pnpm/baz@1/node_modules/baz/x.ts')).toBe(true)
  })

  it('escapes regex metacharacters in package names', () => {
    const re = getLayerNodeModulesExcludePattern(['/proj/node_modules/@scope/foo.bar/'])
    expect(re.test('/proj/node_modules/@scope/foo.bar/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/@scope/fooxbar/server/x.ts')).toBe(true)
  })

  it('strips a trailing slash on the layer root before walking', () => {
    const withSlash = getLayerNodeModulesExcludePattern(['/proj/node_modules/foo/'])
    const withoutSlash = getLayerNodeModulesExcludePattern(['/proj/node_modules/foo'])
    expect(withSlash.source).toBe(withoutSlash.source)
  })
})

describe('nitroRuntimeResolvePlugin', () => {
  function filterRe (plugin: ReturnType<typeof nitroRuntimeResolvePlugin>): RegExp {
    const id = typeof plugin.resolveId === 'object' ? plugin.resolveId.filter?.id : undefined
    return id as RegExp
  }

  it('only matches Nitro\'s implicit runtime dependencies', () => {
    const re = filterRe(nitroRuntimeResolvePlugin())
    for (const id of ['nitro', 'nitro/runtime-config', 'nitro/h3', 'h3', 'h3/tracing', 'srvx', 'defu', 'consola', 'ofetch', 'crossws']) {
      expect(re.test(id), id).toBe(true)
    }
    for (const id of ['vue', 'nitrogen', 'h3x', 'consolation', '@scope/nitro']) {
      expect(re.test(id), id).toBe(false)
    }
  })

  it('falls back to Nitro\'s own copies of its implicit runtime dependencies when the project cannot resolve them', async () => {
    const plugin = nitroRuntimeResolvePlugin()
    for (const [id, expected] of [['nitro', '/nitro/'], ['nitro/runtime-config', '/nitro/'], ['nitro/h3', '/nitro/'], ['h3', '/h3/'], ['srvx', '/srvx/'], ['consola', '/consola/'], ['ofetch', '/ofetch/'], ['crossws', '/crossws/']] as const) {
      const resolved = await callResolveId(plugin, id)
      expect(resolved, id).toBeTypeOf('string')
      expect((resolved as string).replace(/\\/g, '/'), id).toContain(expected)
    }
  })

  it('defers to the project when it can resolve the import itself', async () => {
    const plugin = nitroRuntimeResolvePlugin()
    const resolve = vi.fn().mockResolvedValue({ id: '/project/node_modules/h3/index.mjs' })
    expect(await callResolveId(plugin, 'h3', { resolve: resolve as unknown as PluginContext['resolve'] })).toBeUndefined()
    expect(resolve).toHaveBeenCalledOnce()
  })
})
