import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { snakeCase } from 'scule'
import { z } from 'zod'
import * as context from '../src/context.ts'
import { updateRuntimeConfig, useRuntimeConfig } from '../src/runtime-config.ts'
import { resolveRuntimeConfig } from '../src/internal/runtime-config.ts'

const { mockKlona } = vi.hoisted(() => ({
  mockKlona: vi.fn(),
}))
vi.mock('klona', () => ({
  klona: mockKlona,
}))

const testCases = [
  {
    description:
      'should return runtime config with environment variables applied',
    runtimeConfig: {
      apiUrl: 'http://localhost',
      authUrl: 'http://auth.com',
    },
    envExpansion: true,
    env: {
      NITRO_API_URL: 'http://example.com',
    },
    expected: {
      apiUrl: 'http://example.com',
      authUrl: 'http://auth.com',
    },
  },
  {
    description: 'should expand environment variables in strings',
    runtimeConfig: {
      apiUrl: '{{BASE_URL}}/api',
      mail: '{{MAIL_SCHEME}}://{{MAIL_HOST}}:{{MAIL_PORT}}',
    },
    envExpansion: true,
    env: {
      BASE_URL: 'http://example.com',
      MAIL_SCHEME: 'http',
      MAIL_HOST: 'localhost',
      MAIL_PORT: '3366',
    },
    expected: {
      apiUrl: 'http://example.com/api',
      mail: 'http://localhost:3366',
    },
  },
  {
    description:
      'should not expand environment variables if envExpansion is false',
    runtimeConfig: {
      apiUrl: '{{BASE_URL}}/api',
      someUrl: '',
    },
    envExpansion: false,
    env: {
      BASE_URL: 'http://example1.com',
      NITRO_NOT_API_URL: 'http://example2.com',
      NUXT_SOME_URL: 'http://example3.com',
    },
    expected: {
      apiUrl: '{{BASE_URL}}/api',
      someUrl: 'http://example3.com',
    },
  },
]

const leaf = fc.oneof(fc.string(), fc.constantFrom('hello', '', 'http://x'))
const configKey = fc.constantFrom('apiUrl', 'auth', 'mail', 'port', 'a', 'nested')
const config = fc.letrec<{ value: unknown }>(tie => ({
  value: fc.oneof(
    { weight: 4, arbitrary: leaf },
    { weight: 1, arbitrary: fc.dictionary(configKey, tie('value'), { maxKeys: 3 }) },
  ),
})).value

function run (runtimeConfig: Record<string, unknown>, env: Record<string, string> = {}, envExpansion = false) {
  vi.unstubAllEnvs()
  vi.spyOn(context, 'useNuxt').mockReturnValue({ options: { nitro: { runtimeConfig, experimental: { envExpansion } }, future: { compatibilityVersion: 5 }, _runtimeConfigSchemas: [] } } as any)
  mockKlona.mockReturnValue(structuredClone(runtimeConfig))
  for (const [key, value] of Object.entries(env)) { vi.stubEnv(key, value) }
  return useRuntimeConfig()
}

function leafPaths (value: unknown, path: string[] = []): string[][] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) { return [path] }
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, [...path, key]))
}

describe('useRuntimeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(testCases)('$description', ({ runtimeConfig, envExpansion, env, expected }) => {
    vi.spyOn(context, 'useNuxt').mockReturnValue({ options: { nitro: { runtimeConfig, experimental: { envExpansion } }, future: { compatibilityVersion: 5 }, _runtimeConfigSchemas: [] } } as any)
    mockKlona.mockReturnValue(runtimeConfig)
    Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value))

    expect(useRuntimeConfig()).toEqual(expected)
  })

  it('should cast environment variables with `destr` on versions of Nuxt without runtime config schemas', () => {
    const runtimeConfig = { name: '', port: 3000, session: { secure: true } }
    vi.spyOn(context, 'useNuxt').mockReturnValue({ options: { nitro: { runtimeConfig, experimental: {} } } } as any)
    mockKlona.mockReturnValue(structuredClone(runtimeConfig))
    vi.stubEnv('NUXT_NAME', '4848e0')
    vi.stubEnv('NUXT_PORT', 'abc')
    vi.stubEnv('NUXT_SESSION_SECURE', 'false')

    expect(useRuntimeConfig()).toEqual({ name: 4848, port: 'abc', session: { secure: false } })
  })

  it('should only coerce values with a schema before `compatibilityVersion: 5`', () => {
    const runtimeConfig = { name: '', port: 3000, session: { secure: true, maxAge: 0 } }
    vi.spyOn(context, 'useNuxt').mockReturnValue({
      options: {
        nitro: { runtimeConfig, experimental: {} },
        future: { compatibilityVersion: 4 },
        _runtimeConfigSchemas: [{ path: ['session', 'maxAge'], node: 'i', required: false }, { path: ['token'], node: 's', required: true }],
      },
    } as any)
    mockKlona.mockImplementation(() => structuredClone(runtimeConfig))
    vi.stubEnv('NUXT_NAME', '4848e0')
    vi.stubEnv('NUXT_PORT', 'abc')
    vi.stubEnv('NUXT_SESSION_SECURE', 'false')
    vi.stubEnv('NUXT_SESSION_MAX_AGE', '1.5')

    expect(resolveRuntimeConfig(context.useNuxt())).toEqual({
      config: { name: 4848, port: 'abc', session: { secure: false, maxAge: 0 } },
      issues: [
        { path: 'token', env: 'NUXT_TOKEN', expected: 'string' },
        { path: 'session.maxAge', env: 'NUXT_SESSION_MAX_AGE', expected: 'integer', received: '1.5' },
      ],
    })

    vi.stubEnv('NUXT_SESSION_MAX_AGE', '60')
    expect(useRuntimeConfig().session).toEqual({ secure: false, maxAge: 60 })

    vi.stubEnv('NUXT_SESSION_MAX_AGE', '')
    vi.stubEnv('NUXT_SESSION', '{"secure":true,"maxAge":5}')
    expect(useRuntimeConfig().session).toEqual({ secure: false, maxAge: 5 })
  })
})

describe('useRuntimeConfig env value coercion', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each([
    { defaultValue: '', envValue: '', expected: '' },
    { defaultValue: '', envValue: '0', expected: '0' },
    { defaultValue: '', envValue: '4848e0', expected: '4848e0' },
    { defaultValue: '', envValue: '4.0', expected: '4.0' },
    { defaultValue: '', envValue: 'true', expected: 'true' },
    { defaultValue: '', envValue: 'null', expected: 'null' },
    { defaultValue: '', envValue: '"4848e0"', expected: '"4848e0"' },
    { defaultValue: '', envValue: undefined, expected: '' },
    { defaultValue: 3000, envValue: '8080', expected: 8080 },
    { defaultValue: 3000, envValue: '4.5', expected: 4.5 },
    { defaultValue: 3000, envValue: '', expected: 3000 },
    { defaultValue: 3000, envValue: 'abc', expected: 3000 },
    { defaultValue: true, envValue: 'false', expected: false },
    { defaultValue: true, envValue: '0', expected: false },
    { defaultValue: false, envValue: 'TRUE', expected: true },
    { defaultValue: false, envValue: 'on', expected: true },
    { defaultValue: true, envValue: 'flase', expected: true },
    { defaultValue: ['a'], envValue: '["b","c"]', expected: ['b', 'c'] },
    { defaultValue: ['a'], envValue: '[1]', expected: ['a'] },
    { defaultValue: { a: 1 }, envValue: '{"b":2}', expected: { a: 1, b: 2 } },
  ])('coerces $envValue to the type of $defaultValue', ({ defaultValue, envValue, expected }) => {
    expect(run({ myVar: defaultValue }, envValue === undefined ? {} : { NUXT_MY_VAR: envValue }).myVar).toEqual(expected)
  })

  it('should read environment variables with the configured prefix', () => {
    expect(run({ token: '', nitro: { envPrefix: 'APP_' } }, { APP_TOKEN: 'secret', NUXT_TOKEN: 'ignored' }).token).toBe('secret')
  })

  it('should apply nested environment variables over a JSON object', () => {
    const config = run({ session: { name: 'a', cookie: { secure: true } } }, {
      NUXT_SESSION: '{"name":"b"}',
      NUXT_SESSION_COOKIE_SECURE: 'false',
    })
    expect(config.session).toEqual({ name: 'b', cookie: { secure: false } })
  })

  it('should coerce to the type a schema declares', () => {
    const runtimeConfig = { port: '' }
    vi.spyOn(context, 'useNuxt').mockReturnValue({
      options: {
        nitro: { runtimeConfig, experimental: {} },
        future: { compatibilityVersion: 5 },
        _runtimeConfigSchemas: [{ path: ['port'], node: 'i', required: false }],
      },
    } as any)
    mockKlona.mockImplementation(() => structuredClone(runtimeConfig))
    vi.stubEnv('NUXT_PORT', '8080')
    expect(useRuntimeConfig().port).toBe(8080)

    vi.stubEnv('NUXT_PORT', '1.5')
    expect(useRuntimeConfig().port).toBe('')
  })
})

describe('useRuntimeConfig env application', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should expand an environment variable in a single pass', () => {
    expect(run({ a: '{{X}}' }, { X: '{{Y}}', Y: 'boom' }, true).a).toBe('{{Y}}')
  })

  it('should be the identity when no environment variable matches', () => {
    fc.assert(fc.property(fc.dictionary(configKey, config, { minKeys: 1, maxKeys: 3 }), (runtimeConfig) => {
      expect(run(runtimeConfig)).toEqual(runtimeConfig)
    }), { numRuns: 500 })
  })

  it('should override exactly the targeted leaf', () => {
    fc.assert(fc.property(fc.dictionary(configKey, config, { minKeys: 1, maxKeys: 3 }), fc.nat(), (runtimeConfig, index) => {
      const paths = leafPaths(runtimeConfig)
      fc.pre(paths.length > 0)
      const path = paths[index % paths.length]!
      const envKey = 'NITRO_' + snakeCase(path.join('_')).toUpperCase()

      const result = run(runtimeConfig, { [envKey]: 'sentinel-value' })

      let cursor: any = result
      for (const key of path.slice(0, -1)) { cursor = cursor[key] }
      expect(cursor[path.at(-1)!]).toBe('sentinel-value')

      for (const other of paths) {
        if (other.join('_') === path.join('_')) { continue }
        if (snakeCase(other.join('_')).toUpperCase() === snakeCase(path.join('_')).toUpperCase()) { continue }
        let expected: any = runtimeConfig
        let actual: any = result
        for (const key of other) {
          expected = expected?.[key]
          actual = actual?.[key]
        }
        expect(actual, `${other.join('.')} changed`).toEqual(expected)
      }
    }), { numRuns: 500 })
  })
})

describe('updateRuntimeConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubNuxt (nitro?: { options: Record<string, unknown>, updateConfig: (config: unknown) => void }, { schemas = true } = {}) {
    const nuxt = { options: { nitro: { runtimeConfig: { existing: 'value' } }, _runtimeConfigSchemas: schemas ? [] : undefined }, _nitro: nitro }
    vi.spyOn(context, 'useNuxt').mockReturnValue(nuxt as any)
    vi.spyOn(context, 'tryUseNuxt').mockReturnValue(nuxt as any)
    return nuxt
  }

  it('should merge into the nitro runtime config', () => {
    const nuxt = stubNuxt()

    updateRuntimeConfig({ example: { foo: 'bar' } })

    expect(nuxt.options.nitro.runtimeConfig).toEqual({ existing: 'value', example: { foo: 'bar' } })
  })

  it('should update the nitro instance when there is one', () => {
    const updateConfig = vi.fn()
    const routeRules = { '/**': { ssr: true } }
    stubNuxt({
      options: {
        routeRules,
        runtimeConfig: { existing: 'nitro', example: { baz: 'qux' }, nitro: { envPrefix: 'NUXT_', routeRules } },
      },
      updateConfig,
    })

    updateRuntimeConfig({ example: { foo: 'bar' } })

    expect(updateConfig).toHaveBeenCalledWith({
      runtimeConfig: { existing: 'nitro', example: { foo: 'bar', baz: 'qux' }, nitro: { envPrefix: 'NUXT_', routeRules } },
      routeRules,
    })
  })

  it('should register a schema, keeping configured values as its default', () => {
    const nuxt = stubNuxt()
    nuxt.options.nitro.runtimeConfig = { existing: 'value', myModule: { apiKey: 'user' } } as any

    updateRuntimeConfig({ myModule: z.object({ apiKey: z.string(), retries: z.number().default(3) }) })

    expect(nuxt.options.nitro.runtimeConfig).toEqual({ existing: 'value', myModule: { apiKey: 'user', retries: 3 } })
    expect(nuxt.options._runtimeConfigSchemas).toEqual([
      { path: ['myModule'], node: { p: { apiKey: 's', retries: 'n' }, r: ['apiKey', 'retries'] }, required: false, module: true },
    ])
  })

  it('should keep `null` schema defaults', () => {
    const updateConfig = vi.fn()
    const nuxt = stubNuxt({ options: { runtimeConfig: { myModule: { name: 'a' } } }, updateConfig })
    nuxt.options.nitro.runtimeConfig = { existing: 'value', myModule: { name: 'a' } } as any

    updateRuntimeConfig({ myModule: { url: z.string().nullable().default(null) } })

    expect(nuxt.options.nitro.runtimeConfig).toEqual({ existing: 'value', myModule: { name: 'a', url: null } })
    expect(updateConfig.mock.calls[0]![0].runtimeConfig).toEqual({ myModule: { name: 'a', url: null } })
  })

  it('should replace a schema with its default on versions of Nuxt without runtime config schemas', () => {
    const nuxt = stubNuxt(undefined, { schemas: false })
    nuxt.options.nitro.runtimeConfig = { existing: 'value', myModule: { retries: 5 } } as any

    updateRuntimeConfig({
      myModule: z.object({
        apiKey: z.string(),
        retries: z.number().default(3),
        timeout: z.number().optional(),
        db: z.object({ url: z.string() }),
      }),
      token: z.string(),
      region: z.string().optional(),
    })

    expect(nuxt.options.nitro.runtimeConfig).toEqual({ existing: 'value', myModule: { apiKey: '', retries: 5, db: { url: '' } }, token: '' })
    expect(nuxt.options._runtimeConfigSchemas).toBeUndefined()
  })

  it('should not warn when nitro is not initialized yet', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubNuxt()

    updateRuntimeConfig({ example: { foo: 'bar' } })

    expect(warn).not.toHaveBeenCalled()
  })
})
