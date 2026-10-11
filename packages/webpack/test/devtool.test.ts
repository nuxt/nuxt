import { describe, expect, it } from 'vitest'
import { impl } from '../src/impl.ts'
import { clientDevtool } from '../src/configs/client.ts'
import type { WebpackConfigContext } from '../src/utils/config.ts'

function createContext (client: boolean | 'hidden', isDev: boolean) {
  return {
    isDev,
    config: { output: {} },
    nuxt: { options: { sourcemap: { client, server: false } } },
  } as unknown as WebpackConfigContext
}

describe('webpack devtool', () => {
  it.each([
    [true, 'eval-cheap-module-source-map'],
    ['hidden', 'hidden-cheap-module-source-map'],
  ] as const)('uses a valid client devtool in dev for `%s`', (value, devtool) => {
    const ctx = createContext(value, true)
    clientDevtool(ctx)
    expect(ctx.config.devtool).toBe(devtool)
    expect(() => impl.webpack.validate({ devtool })).not.toThrow()
  })

  it.each([
    [true, 'source-map'],
    ['hidden', 'hidden-source-map'],
    [false, false],
  ] as const)('keeps the production client devtool for `%s`', (value, devtool) => {
    const ctx = createContext(value, false)
    clientDevtool(ctx)
    expect(ctx.config.devtool).toBe(devtool)
  })
})
