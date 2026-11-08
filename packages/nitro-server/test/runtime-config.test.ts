import { rollup } from 'rollup'
import type { Plugin } from 'rollup'
import { describe, expect, it, vi } from 'vitest'

import { getRuntimeConfigSchemaModule, runtimeConfigPlugin } from '../src/runtime-config.ts'
import { createRuntimeConfigResolver } from '../src/runtime/utils/runtime-config.ts'

const RUNTIME_CONFIG = '/nuxt/nitro-server/dist/runtime/runtime-config'
const NITRO_CONFIG = '/project/node_modules/nitropack/dist/runtime/internal/config.mjs'

async function bundle (modules: Record<string, string>, strict?: boolean) {
  const virtual: Plugin = {
    name: 'virtual',
    resolveId: id => id in modules ? id : undefined,
    load: id => modules[id],
  }
  const build = await rollup({
    input: 'entry',
    external: id => id === RUNTIME_CONFIG,
    plugins: [runtimeConfigPlugin(RUNTIME_CONFIG, { strict }) as Plugin, virtual],
  })
  try {
    const { output } = await build.generate({ format: 'esm' })
    return output[0].code
  } finally {
    await build.close()
  }
}

describe('runtimeConfigPlugin', () => {
  it('should replace nitro\'s runtime config module', async () => {
    const code = await bundle({
      'entry': `export { useRuntimeConfig, useAppConfig } from ${JSON.stringify(NITRO_CONFIG)}`,
      [NITRO_CONFIG]: [
        `import { applyEnv } from './utils.env.mjs'`,
        `export function useRuntimeConfig () { return applyEnv({}, {}) }`,
        `export function useAppConfig () { return {} }`,
      ].join('\n'),
    }, true)

    expect(code).toContain(`from '${RUNTIME_CONFIG}'`)
    expect(code).not.toContain('applyEnv')
  })

  it('should leave other modules that read the runtime config', async () => {
    const code = await bundle({
      'entry': `export function useRuntimeConfig () { return {} }`,
    })

    expect(code).toContain('useRuntimeConfig')
    expect(code).not.toContain(RUNTIME_CONFIG)
  })

  it('should throw in strict mode when nitro\'s module was not replaced', async () => {
    const error = await bundle({ entry: `export const useRuntimeConfig = () => ({})` }, true).catch(error => error)
    expect(JSON.stringify({ ...error, message: error.message })).toContain('NUXT_B9012')
  })
})

describe('getRuntimeConfigSchemaModule', () => {
  const runtimeConfig = { token: '', moduleToken: '', public: {} }
  const _runtimeConfigSchemas = [
    { path: ['token'], node: 's' as const, required: true },
    { path: ['moduleToken'], node: 's' as const, required: true, module: true },
  ]
  const nitro = { options: { runtimeConfig } } as any

  it('should only list the schemas from `nuxt.config` as strict before compatibility version 5', () => {
    const nuxt = { options: { _runtimeConfigSchemas, future: {} } } as any

    expect(getRuntimeConfigSchemaModule(nuxt, nitro)).toContain('export const strictPaths = ["token"]')
  })

  it('should treat every schema as strict with compatibility version 5', () => {
    const nuxt = { options: { _runtimeConfigSchemas, future: { compatibilityVersion: 5 } } } as any

    expect(getRuntimeConfigSchemaModule(nuxt, nitro)).toContain('export const strictPaths = undefined')
  })
})

describe('createRuntimeConfigResolver', () => {
  const config = {
    app: { baseURL: '/' },
    nitro: { envPrefix: 'NUXT_' },
    apiSecret: '',
    port: 3000,
    plain: '',
    public: { mode: 'preview', flag: false },
  }
  const schema = {
    p: {
      apiSecret: 's' as const,
      port: 'n' as const,
      public: { p: { mode: { e: ['preview', 'production'] } } },
    },
    r: ['apiSecret'],
  }

  it('should coerce values with a schema and cast the rest with destr', () => {
    const resolve = createRuntimeConfigResolver(config, schema, {
      NUXT_API_SECRET: '4848e0',
      NUXT_PORT: '4000',
      NUXT_PLAIN: '4848e0',
      NUXT_PUBLIC_MODE: 'production',
      NUXT_PUBLIC_FLAG: 'true',
    })

    expect(resolve()).toEqual({
      ...config,
      apiSecret: '4848e0',
      port: 4000,
      plain: 4848e0,
      public: { mode: 'production', flag: true },
    })
  })

  it('should return a fresh copy each time, leaving the serialised config as it was', () => {
    const resolve = createRuntimeConfigResolver(config, schema, { NUXT_API_SECRET: 'secret' })
    const first = resolve()
    first.port = 1

    expect(resolve().port).toBe(3000)
    expect(config.apiSecret).toBe('')
  })

  it('should throw NUXT_E8014 for values that do not match their schema', () => {
    const resolve = createRuntimeConfigResolver(config, schema, { NUXT_API_SECRET: 'secret', NUXT_PORT: 'abc' })

    expect(resolve).toThrow('NUXT_E8014')
    expect(resolve).toThrow('NUXT_E8014')
  })

  it('should throw NUXT_E8014 when a required value is missing', () => {
    const resolve = createRuntimeConfigResolver({ ...config, apiSecret: undefined }, schema, {})

    expect(resolve).toThrow('`apiSecret` is required')
  })

  it('should keep an object value that an environment variable sets to `null`, as nitro does', () => {
    const resolve = createRuntimeConfigResolver(config, schema, { NUXT_API_SECRET: 'secret', NUXT_APP: 'null' })

    expect(resolve().app).toEqual({ baseURL: '/' })
  })

  it('should only warn, once, for values outside `strictPaths`, keeping their default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resolve = createRuntimeConfigResolver({ ...config, apiSecret: undefined }, schema, { NUXT_PORT: 'abc' }, ['public'])

    expect(resolve()).toMatchObject({ apiSecret: undefined, port: 3000 })
    resolve()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]!.join(' ')).toMatch(/NUXT_E8014[\s\S]*`apiSecret` is required[\s\S]*`port`/)
    warn.mockRestore()
  })

  it('should keep the default of a lenient object when an environment variable replaces it with a primitive', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const session = { maxAge: 60, secure: true }
    const resolve = createRuntimeConfigResolver({ nitro: { envPrefix: 'NUXT_' }, session }, { p: { session: { p: { maxAge: 'n' } } } }, { NUXT_SESSION: 'false', NUXT_SESSION_SECURE: 'false' }, [])

    expect(resolve().session).toEqual({ maxAge: 60, secure: false })
    expect(warn.mock.calls.flat().join(' ')).toContain('NUXT_E8014')
    expect(session).toEqual({ maxAge: 60, secure: true })
    warn.mockRestore()
  })

  it('should throw for values within `strictPaths`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resolve = createRuntimeConfigResolver(config, schema, { NUXT_API_SECRET: 'secret', NUXT_PORT: 'abc', NUXT_PUBLIC_MODE: 'staging' }, ['public.mode'])

    expect(resolve).toThrow(/`public\.mode`/)
    expect(resolve).not.toThrow(/`port`/)
    warn.mockRestore()
  })

  it('should follow nitro\'s env prefixes', () => {
    const resolve = createRuntimeConfigResolver(config, schema, { NITRO_API_SECRET: 'from-nitro', NITRO_PLAIN: 'yes' })

    expect(resolve()).toMatchObject({ apiSecret: 'from-nitro', plain: 'yes' })
  })
})
