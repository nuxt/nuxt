import { afterEach, describe, expect, it, vi } from 'vitest'
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
