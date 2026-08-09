import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { TypeCheckPlugin } from '../src/plugins/type-check.ts'
import { VitePluginCheckerPlugin } from '../src/plugins/vite-plugin-checker.ts'

function createNuxt (typeCheck: boolean | 'build' | 'dev', options: { dev?: boolean, test?: boolean } = {}) {
  return {
    options: {
      dev: false,
      test: false,
      ssr: false,
      rootDir: resolve(import.meta.dirname, '../../..'),
      ...options,
      typescript: { typeCheck },
    },
  } as Nuxt
}

describe('TypeCheckPlugin', () => {
  it.each([
    [true, true],
    ['build', false],
    ['dev', true],
    [false, false],
  ] as const)('applies in dev when typeCheck is %s: %s', (typeCheck, expected) => {
    const plugin = TypeCheckPlugin(createNuxt(typeCheck, { dev: true }))
    expect(typeof plugin.apply === 'function' && plugin.apply({} as never, {} as never)).toBe(expected)
  })

  it('does not apply in test mode', () => {
    const plugin = TypeCheckPlugin(createNuxt('dev', { dev: true, test: true }))
    expect(typeof plugin.apply === 'function' && plugin.apply({} as never, {} as never)).toBe(false)
  })

  it('only injects the checker runtime into the client entry in development', () => {
    const plugin = TypeCheckPlugin(createNuxt('dev', { dev: true }))
    const applyToEnvironment = plugin.applyToEnvironment as (environment: { name: string, config: { isProduction: boolean } }) => boolean
    expect(applyToEnvironment({ name: 'client', config: { isProduction: false } })).toBe(true)
    expect(applyToEnvironment({ name: 'ssr', config: { isProduction: false } })).toBe(false)
    expect(applyToEnvironment({ name: 'client', config: { isProduction: true } })).toBe(false)
  })
})

describe('VitePluginCheckerPlugin', () => {
  it.each([
    [true, true, true],
    [true, false, true],
    ['build', true, false],
    ['build', false, true],
    ['dev', true, true],
    ['dev', false, false],
    [false, true, false],
    [false, false, false],
  ] as const)('returns plugins when typeCheck is %s and dev is %s: %s', async (typeCheck, dev, expected) => {
    const plugins = await VitePluginCheckerPlugin(createNuxt(typeCheck, { dev }))
    expect(!!plugins?.length).toBe(expected)
  })

  it('does not register the checker in test mode', async () => {
    expect(await VitePluginCheckerPlugin(createNuxt('dev', { dev: true, test: true }))).toBeUndefined()
  })
})
