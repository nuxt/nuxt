import fc from 'fast-check'
import { snakeCase } from 'scule'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfigSchemaObject } from '@nuxt/schema/internal'

import { applyRuntimeConfigSchema, formatRuntimeConfigIssues, toEnvKey } from '../src/runtime/server/runtime-config/schema'
import { createRuntimeConfig } from '../src/runtime/server/runtime-config'
import { guardMissingRuntimeConfig } from '../src/runtime/server/runtime-config/prerender'

function apply (config: Record<string, unknown>, schema: RuntimeConfigSchemaObject, env: Record<string, string> = {}, envExpansion = false) {
  const issues = applyRuntimeConfigSchema(config, schema, { env, prefix: 'NITRO_', altPrefix: 'NUXT_', envExpansion })
  return { config, issues }
}

describe('applyRuntimeConfigSchema', () => {
  it('should coerce environment variables to the type of their schema', () => {
    const { config, issues } = apply(
      { name: 'a', port: 3000, workers: 1, secure: true, empty: null, list: ['a'], mode: 'dev', any: '' },
      { p: { name: 's', port: 'n', workers: 'i', secure: 'b', empty: 'z', list: { a: 's' }, mode: { e: ['dev', 'prod'] }, any: '*' } },
      { NUXT_NAME: '0123', NUXT_PORT: '4.5', NUXT_WORKERS: '4', NUXT_SECURE: 'false', NUXT_EMPTY: 'null', NUXT_LIST: '["b"]', NUXT_MODE: 'prod', NUXT_ANY: '{"a":1}' },
    )
    expect(issues).toEqual([])
    expect(config).toEqual({ name: '0123', port: 4.5, workers: 4, secure: false, empty: null, list: ['b'], mode: 'prod', any: { a: 1 } })
  })

  it('should report values that cannot be coerced, keeping their defaults', () => {
    const { config, issues } = apply(
      { port: 3000, workers: 1, secure: true, list: ['a'] },
      { p: { port: 'n', workers: 'i', secure: 'b', list: { a: 's' } } },
      { NUXT_PORT: 'abc', NUXT_WORKERS: '1.5', NITRO_SECURE: 'flase', NUXT_LIST: '[1]' },
    )
    expect(config).toEqual({ port: 3000, workers: 1, secure: true, list: ['a'] })
    expect(issues).toEqual([
      { path: 'port', env: 'NUXT_PORT', expected: 'number', received: 'abc' },
      { path: 'workers', env: 'NUXT_WORKERS', expected: 'integer', received: '1.5' },
      { path: 'secure', env: 'NITRO_SECURE', expected: 'boolean', received: 'flase' },
      { path: 'list', env: 'NUXT_LIST', expected: 'array', received: [1] },
    ])
  })

  it('should keep the defaults of invalid values within a JSON object', () => {
    const { config, issues } = apply(
      { session: { name: 'a', maxAge: 1, cookie: { secure: true } } },
      { p: { session: { p: { name: 's', maxAge: 'n', cookie: { p: { secure: 'b' } }, pin: 'n' } } } },
      { NUXT_SESSION: '{"name":"b","maxAge":"invalid","cookie":"x","pin":"1234"}' },
    )
    expect(config.session).toEqual({ name: 'b', maxAge: 1, cookie: { secure: true } })
    expect(issues.map(issue => issue.path)).toEqual(['session.maxAge', 'session.cookie', 'session.pin'])
  })

  it('should keep the default when a JSON object and a nested variable are both invalid', () => {
    const { config, issues } = apply(
      { session: { maxAge: 1 } },
      { p: { session: { p: { maxAge: 'n' } } } },
      { NUXT_SESSION: '{"maxAge":"x"}', NUXT_SESSION_MAX_AGE: 'y' },
    )
    expect(config.session).toEqual({ maxAge: 1 })
    expect(issues).toEqual([{ path: 'session.maxAge', env: 'NUXT_SESSION_MAX_AGE', expected: 'number', received: 'y' }])
  })

  it('should treat an empty variable as unset for a value that cannot be empty', () => {
    const { config, issues } = apply({ port: 3000, name: 'a' }, { p: { port: 'n', name: 's' } }, { NUXT_PORT: '', NUXT_NAME: '' })
    expect(issues).toEqual([])
    expect(config).toEqual({ port: 3000, name: '' })
  })

  it('should prefer the `NITRO_` prefix', () => {
    expect(apply({ name: '' }, { p: { name: 's' } }, { NITRO_NAME: 'nitro', NUXT_NAME: 'nuxt' }).config.name).toBe('nitro')
  })

  it('should report a required value that is not provided', () => {
    const schema: RuntimeConfigSchemaObject = { p: { secret: 's', db: { p: { url: 's', pool: 'n' }, r: ['url'] } }, r: ['secret'] }
    expect(apply({ db: { pool: 5 } }, schema).issues).toEqual([
      { path: 'secret', env: 'NUXT_SECRET', expected: 'string' },
      { path: 'db.url', env: 'NUXT_DB_URL', expected: 'string' },
    ])
    expect(apply({}, schema, { NUXT_SECRET: 'x', NUXT_DB_URL: 'postgres://' })).toEqual({
      config: { secret: 'x', db: { url: 'postgres://' } },
      issues: [],
    })
  })

  it('should leave out an optional object that is not provided', () => {
    const { config, issues } = apply({}, { p: { db: { p: { url: 's' }, r: ['url'] } } })
    expect(issues).toEqual([])
    expect(config).toEqual({})
  })

  it('should apply the defaults of an optional object that is provided', () => {
    const schema: RuntimeConfigSchemaObject = { p: { db: { p: { host: 's', port: 'n' }, r: ['host', 'port'], d: { port: 5432 } } } }
    expect(apply({}, schema)).toEqual({ config: {}, issues: [] })
    expect(apply({}, schema, { NUXT_DB_HOST: 'x' })).toEqual({ config: { db: { host: 'x', port: 5432 } }, issues: [] })
    expect(apply({}, schema, { NUXT_DB_HOST: 'x', NUXT_DB_PORT: '1' })).toEqual({ config: { db: { host: 'x', port: 1 } }, issues: [] })
    expect(apply({ db: { host: 'y' } }, schema)).toEqual({ config: { db: { host: 'y', port: 5432 } }, issues: [] })
  })

  it('should apply the defaults of the object member of a union', () => {
    const schema: RuntimeConfigSchemaObject = { p: { storage: { o: [{ e: [false] }, { p: { driver: 's', port: 'n' }, r: ['driver', 'port'], d: { port: 6379 } }] } } }
    expect(apply({}, schema, { NUXT_STORAGE_DRIVER: 'redis' })).toEqual({ config: { storage: { driver: 'redis', port: 6379 } }, issues: [] })
    expect(apply({ storage: false }, schema, { NUXT_STORAGE: '{"driver":"redis"}' })).toEqual({ config: { storage: { driver: 'redis', port: 6379 } }, issues: [] })
  })

  it('should report invalid variables within an optional object that is not provided', () => {
    expect(apply({}, { p: { db: { p: { pool: 'n' } } } }, { NUXT_DB_POOL: 'abc' })).toEqual({
      config: {},
      issues: [{ path: 'db.pool', env: 'NUXT_DB_POOL', expected: 'number', received: 'abc' }],
    })
  })

  it('should merge a JSON object over its default, then apply nested variables', () => {
    const { config } = apply(
      { session: { name: 'a', maxAge: 1, cookie: { secure: true } } },
      { p: { session: { p: { name: 's', maxAge: 'n', cookie: { p: { secure: 'b' } } } } } },
      { NUXT_SESSION: '{"name":"b"}', NUXT_SESSION_MAX_AGE: '60', NUXT_SESSION_COOKIE_SECURE: 'false' },
    )
    expect(config.session).toEqual({ name: 'b', maxAge: 60, cookie: { secure: false } })
  })

  it('should keep nested defaults when merging a JSON object', () => {
    const { config, issues } = apply(
      { session: { cookie: { name: 'a', secure: true } } },
      { p: { session: { p: { cookie: { p: { name: 's', secure: 'b' }, r: ['name', 'secure'] } } } } },
      { NUXT_SESSION: '{"cookie":{"name":"b"},"__proto__":{"polluted":true}}' },
    )
    expect(issues).toEqual([])
    expect(config.session).toEqual({ cookie: { name: 'b', secure: true } })
    expect(Object.getPrototypeOf(config.session)).toBe(Object.prototype)
  })

  it('should try each member of a union in order', () => {
    const schema: RuntimeConfigSchemaObject = { p: { feature: { o: ['b', { p: { option: 'b' } }] }, id: { o: ['n', 's'] } } }
    expect(apply({ feature: { option: true }, id: 1 }, schema, { NUXT_FEATURE: 'false', NUXT_ID: 'abc' })).toEqual({ config: { feature: false, id: 'abc' }, issues: [] })
    expect(apply({ feature: { option: true }, id: 1 }, schema, { NUXT_FEATURE_OPTION: 'false', NUXT_ID: '2' })).toEqual({ config: { feature: { option: false }, id: 2 }, issues: [] })
  })

  it('should merge a partial JSON object for a union over its default', () => {
    const schema: RuntimeConfigSchemaObject = { p: { feature: { o: ['b', { p: { option: 'b', name: 's' }, r: ['option', 'name'] }] } } }
    expect(apply({ feature: { option: true, name: 'a' } }, schema, { NUXT_FEATURE: '{"option":false}' })).toEqual({
      config: { feature: { option: false, name: 'a' } },
      issues: [],
    })
  })

  it('should apply variables to the member of a union that matches the default', () => {
    const schema: RuntimeConfigSchemaObject = {
      p: {
        storage: {
          o: [
            { p: { driver: { e: ['fs'] }, base: 's' }, r: ['driver', 'base'] },
            { p: { driver: { e: ['redis'] }, port: 'n' }, r: ['driver', 'port'] },
          ],
        },
      },
    }
    expect(apply({ storage: { driver: 'redis', port: 6379 } }, schema, { NUXT_STORAGE_PORT: '6380' })).toEqual({
      config: { storage: { driver: 'redis', port: 6380 } },
      issues: [],
    })
    expect(apply({ storage: { driver: 'fs', base: '/data' } }, schema, { NUXT_STORAGE_DRIVER: 'redis', NUXT_STORAGE_PORT: '6380' })).toEqual({
      config: { storage: { driver: 'redis', base: '/data', port: 6380 } },
      issues: [],
    })
    expect(apply({}, schema, { NUXT_STORAGE_DRIVER: 'redis', NUXT_STORAGE_PORT: '6380' })).toEqual({
      config: { storage: { driver: 'redis', port: 6380 } },
      issues: [],
    })
    expect(apply({}, schema)).toEqual({ config: {}, issues: [] })
    expect(apply({ storage: { driver: 'fs', base: '/data' } }, schema, { NUXT_STORAGE_DRIVER: 'redis' })).toEqual({
      config: { storage: { driver: 'fs', base: '/data' } },
      issues: [{ path: 'storage.driver', env: 'NUXT_STORAGE_DRIVER', expected: '"fs"', received: 'redis' }],
    })
  })

  it('should report a default that does not match its schema', () => {
    expect(apply({ port: 'abc' }, { p: { port: 'n' } }).issues).toEqual([{ path: 'port', env: 'NUXT_PORT', expected: 'number', received: 'abc' }])
  })

  it('should leave keys without a schema untouched', () => {
    const { config } = apply({ nitro: { envPrefix: 'NUXT_' }, name: '' }, { p: { name: 's' } }, { NUXT_NITRO_ENV_PREFIX: 'X_' })
    expect(config.nitro).toEqual({ envPrefix: 'NUXT_' })
  })

  it('should expand variables in strings once', () => {
    const { config } = apply({ url: '{{HOST}}/api', other: '' }, { p: { url: 's', other: 's' } }, { HOST: 'https://{{X}}', X: 'x', NUXT_OTHER: '{{X}}' }, true)
    expect(config).toEqual({ url: 'https://{{X}}/api', other: 'x' })
  })

  it('should expand variables before checking them', () => {
    const schema: RuntimeConfigSchemaObject = { p: { port: 'n', mode: { e: ['dev', 'prod'] } } }
    expect(apply({ port: 3000, mode: '{{MODE}}' }, schema, { PORT: '8080', MODE: 'prod', NUXT_PORT: '{{PORT}}' }, true)).toEqual({
      config: { port: 8080, mode: 'prod' },
      issues: [],
    })
    const feature: RuntimeConfigSchemaObject = { p: { feature: { o: ['b', { p: { name: 's' } }] } } }
    expect(apply({ feature: true }, feature, { FLAG: 'false', NUXT_FEATURE: '{{FLAG}}' }, true).config).toEqual({ feature: false })
    expect(apply({ feature: true }, feature, { X: '{{Y}}', NUXT_FEATURE: '{"name":"{{X}}"}' }, true).config).toEqual({ feature: { name: '{{Y}}' } })
    expect(apply({ port: 3000, mode: 'dev' }, schema, { MODE: 'other', NUXT_MODE: '{{MODE}}' }, true).issues).toEqual([
      { path: 'mode', env: 'NUXT_MODE', expected: '"dev" | "prod"', received: 'other' },
    ])
  })
})

describe('formatRuntimeConfigIssues', () => {
  it('should only show received values for public runtime config', () => {
    expect(formatRuntimeConfigIssues([
      { path: 'public.port', env: 'NUXT_PUBLIC_PORT', expected: 'number', received: 'abc', public: true },
      { path: 'secret', env: 'NUXT_SECRET', expected: '"a" | "b"', received: 'hunter2' },
      { path: 'public.pin', env: 'NUXT_PUBLIC_PIN', expected: 'number', received: '1234' },
      { path: 'list', env: 'NUXT_LIST', expected: 'string[]', received: [1] },
      { path: 'options', env: 'NUXT_OPTIONS', expected: 'object', received: null },
      { path: 'token', env: 'NUXT_TOKEN', expected: 'string' },
    ])).toMatchInlineSnapshot(`
      "\`public.port\` (\`NUXT_PUBLIC_PORT\`) must be number, but received "abc".
        - \`secret\` (\`NUXT_SECRET\`) must be "a" | "b", but received a string.
        - \`public.pin\` (\`NUXT_PUBLIC_PIN\`) must be number, but received a string.
        - \`list\` (\`NUXT_LIST\`) must be string[], but received an array.
        - \`options\` (\`NUXT_OPTIONS\`) must be object, but received null.
        - \`token\` is required. Set \`NUXT_TOKEN\` or provide a default."
    `)
  })

  it('should mark issues within the public runtime config', () => {
    const { issues } = apply({ 'public.pin': 0, 'public': { port: 0 } }, { p: { 'public.pin': 'n', 'public': { p: { port: 'n' } } } }, { NUXT_PUBLIC_PIN: '1234x', NUXT_PUBLIC_PORT: 'abc' })
    expect(issues).toEqual([
      { path: 'public.pin', env: 'NUXT_PUBLIC_PIN', expected: 'number', received: '1234x' },
      { path: 'public.port', env: 'NUXT_PUBLIC_PORT', expected: 'number', received: 'abc', public: true },
    ])
  })
})

describe('guardMissingRuntimeConfig', () => {
  it('should throw when a missing required value is read', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const schema: RuntimeConfigSchemaObject = {
      p: { cmsUrl: 's', title: 's', public: { o: [{ p: { token: 's', site: 's' }, r: ['token'] }, 's'] } },
      r: ['cmsUrl', 'title', 'public'],
    }
    const { config, issues } = apply({ title: 'a', public: { site: 'b' } }, schema)
    const guarded = guardMissingRuntimeConfig(config, schema, issues) as Record<string, any>

    expect(guarded.title).toBe('a')
    expect(guarded.public.site).toBe('b')
    expect('cmsUrl' in guarded).toBe(false)
    expect(JSON.stringify(guarded)).toBe('{"title":"a","public":{"site":"b"}}')
    expect(() => guarded.cmsUrl).toThrow('`cmsUrl` was read while prerendering, but it is required and `NUXT_CMS_URL` is not set.')
    expect(() => guarded.cmsUrl).toThrow('NUXT_CMS_URL')
    expect(() => guarded.public.token).toThrow('`public.token` was read while prerendering, but it is required and `NUXT_PUBLIC_TOKEN` is not set.')
    expect(log).toHaveBeenCalledTimes(2)

    guarded.cmsUrl = 'https://cms.example.com'
    expect(guarded.cmsUrl).toBe('https://cms.example.com')
    log.mockRestore()
  })
})

describe('createRuntimeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should apply the environment to the runtime config once', () => {
    vi.stubEnv('NUXT_SECURE', 'false')
    const config = { secure: true, nitro: { envPrefix: 'NUXT_' } }
    const useRuntimeConfig = createRuntimeConfig(config, { p: { secure: 'b' } })

    expect(useRuntimeConfig()).toBe(config)
    expect(config).toEqual({ secure: false, nitro: { envPrefix: 'NUXT_' } })

    vi.stubEnv('NUXT_SECURE', 'true')
    expect(useRuntimeConfig().secure).toBe(false)
  })

  it('should use the prefix from the runtime config', () => {
    vi.stubEnv('APP_NAME', 'custom')
    vi.stubEnv('NUXT_NAME', 'nuxt')
    expect(createRuntimeConfig({ name: '', nitro: { envPrefix: 'APP_' } }, { p: { name: 's' } })().name).toBe('custom')
    expect(createRuntimeConfig({ name: '' }, { p: { name: 's' } })().name).toBe('nuxt')
  })

  it('should throw on every call when the runtime config does not match its schema', () => {
    vi.stubEnv('NUXT_PORT', 'abc')
    const useRuntimeConfig = createRuntimeConfig({ port: 3000 }, { p: { port: 'n' } })

    expect(() => useRuntimeConfig()).toThrow('`port` (`NUXT_PORT`) must be number')
    expect(() => useRuntimeConfig()).toThrow('`port` (`NUXT_PORT`) must be number')
  })

  it('should only warn for values outside `strictPaths`, keeping their default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NUXT_PORT', 'abc')
    const useRuntimeConfig = createRuntimeConfig({ port: 3000, token: undefined }, { p: { port: 'n', token: 's' }, r: ['token'] }, ['token'])

    expect(() => useRuntimeConfig()).toThrow('`token` is required')
    expect(createRuntimeConfig({ port: 3000 }, { p: { port: 'n' } }, ['token'])().port).toBe(3000)
    expect(warn.mock.calls.flat().join(' ')).toContain('`port` (`NUXT_PORT`) must be number')
    warn.mockRestore()
  })
})

describe('toEnvKey', () => {
  it('should split words as `scule` does', () => {
    const char = fc.constantFrom('a', 'b', 'A', 'B', '1', '_', '-', '.', '/', 'é', 'É')
    fc.assert(fc.property(fc.array(char, { maxLength: 12 }).map(chars => chars.join('')), (key) => {
      expect(toEnvKey(key)).toBe(snakeCase(key).toUpperCase())
    }), { numRuns: 5000 })
    expect(toEnvKey('session_apiKey')).toBe('SESSION_API_KEY')
    expect(toEnvKey('myAPIKey')).toBe('MY_API_KEY')
  })
})
