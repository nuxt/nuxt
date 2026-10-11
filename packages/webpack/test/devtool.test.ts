import { describe, expect, it } from 'vitest'
import { impl } from '../src/impl.ts'
import { clientDevtool } from '../src/configs/client.ts'
import { serverPreset } from '../src/configs/server.ts'
import type { WebpackConfigContext } from '../src/utils/config.ts'

type SourcemapOption = boolean | 'hidden' | 'nosource'

function createContext (sourcemap: { client: SourcemapOption, server: SourcemapOption }, isDev: boolean) {
  return {
    isDev,
    config: { output: {} },
    nuxt: { options: { sourcemap } },
  } as unknown as WebpackConfigContext
}

describe('webpack devtool', () => {
  it.each([
    [false, 'nosources-source-map'],
    [true, 'eval-nosources-cheap-module-source-map'],
  ])('uses a nosources client devtool for `nosource` (dev: %s)', (isDev, devtool) => {
    const ctx = createContext({ client: 'nosource', server: false }, isDev)
    clientDevtool(ctx)
    expect(ctx.config.devtool).toBe(devtool)
    expect(() => impl.webpack.validate({ devtool })).not.toThrow()
  })

  it.each([
    [false, 'nosources-source-map'],
    [true, 'nosources-cheap-module-source-map'],
  ])('uses a nosources server devtool for `nosource` (dev: %s)', (isDev, devtool) => {
    const ctx = createContext({ client: false, server: 'nosource' }, isDev)
    serverPreset(ctx)
    expect(ctx.config.devtool).toBe(devtool)
    expect(() => impl.webpack.validate({ devtool })).not.toThrow()
  })

  it.each([
    [true, 'eval-cheap-module-source-map'],
    ['hidden', 'hidden-cheap-module-source-map'],
  ] as const)('uses a valid client devtool in dev for `%s`', (value, devtool) => {
    const ctx = createContext({ client: value, server: false }, true)
    clientDevtool(ctx)
    expect(ctx.config.devtool).toBe(devtool)
    expect(() => impl.webpack.validate({ devtool })).not.toThrow()
  })

  it.each([
    [true, 'source-map'],
    ['hidden', 'hidden-source-map'],
    [false, false],
  ] as const)('keeps the production devtool for `%s`', (value, devtool) => {
    const client = createContext({ client: value, server: value }, false)
    clientDevtool(client)
    expect(client.config.devtool).toBe(devtool)

    const server = createContext({ client: value, server: value }, false)
    serverPreset(server)
    expect(server.config.devtool).toBe(devtool)
  })
})
