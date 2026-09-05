import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { snakeCase } from 'scule'
import * as context from './context.ts'
import { useRuntimeConfig } from './runtime-config.ts'

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
  vi.spyOn(context, 'useNuxt').mockReturnValue({ options: { nitro: { runtimeConfig, experimental: { envExpansion } } } } as any)
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
    vi.spyOn(context, 'useNuxt').mockReturnValue({ options: { nitro: { runtimeConfig, experimental: { envExpansion } } } } as any)
    mockKlona.mockReturnValue(runtimeConfig)
    Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value))

    expect(useRuntimeConfig()).toEqual(expected)
  })
})

// These tests document the current environment variable value coercion
// behaviour (see https://github.com/nuxt/nuxt/issues/24812). Environment
// variable values are passed through `destr`, so JSON-compatible values are
// deserialized. They pin the existing behaviour to catch unintended changes.
describe('useRuntimeConfig env value casting', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each([
    { envValue: '', expected: '' },
    { envValue: 'hello-world', expected: 'hello-world' },
    { envValue: '0', expected: 0 },
    { envValue: '3000', expected: 3000 },
    { envValue: 'true', expected: true },
    { envValue: 'false', expected: false },
    { envValue: undefined, expected: '' },
    { envValue: 'undefined', expected: '' },
    { envValue: 'null', expected: '' },
    { envValue: '4848e0', expected: 4848 },
    { envValue: '"4848e0"', expected: '4848e0' },
    { envValue: '""4848e0""', expected: '"4848e0"' },
    { envValue: '{ foo: "bar" }', expected: '{ foo: "bar" }' },
  ])('casts $envValue to $expected', ({ envValue, expected }) => {
    const runtimeConfig = { myVar: '' }
    vi.spyOn(context, 'useNuxt').mockReturnValue({ options: { nitro: { runtimeConfig, experimental: { envExpansion: false } } } } as any)
    mockKlona.mockReturnValue(runtimeConfig)
    vi.stubEnv('NITRO_MY_VAR', envValue)

    expect(useRuntimeConfig().myVar).toEqual(expected)
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
