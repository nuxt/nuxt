import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import * as v from 'valibot'
import { toStandardJsonSchema } from '@valibot/to-json-schema'
import { type } from 'arktype'
import type { RuntimeConfigSchema } from '@nuxt/schema'
import type { RuntimeConfigSchemaEntry } from '@nuxt/schema/internal'

import { configDiagnostics } from '../src/diagnostics/config.ts'
import {
  compileRuntimeConfigSchema,
  extractModuleRuntimeConfigSchemas,
  extractRuntimeConfigSchemas,
  findRuntimeConfigSchema,
  getRuntimeConfigSchema,
  mergeRuntimeConfigSchemas,
  runtimeConfigSchemaToType,
} from '../src/internal/runtime-config.ts'

describe('compileRuntimeConfigSchema', () => {
  it('should describe a zod schema and resolve its defaults', () => {
    const schema = z.object({
      secure: z.boolean().default(true),
      flag: z.stringbool(),
      port: z.number().int().optional(),
      mode: z.enum(['dev', 'prod']).default('dev'),
      url: z.url().nullable(),
      tags: z.array(z.string()).default([]),
    })
    expect(compileRuntimeConfigSchema(schema)).toEqual({
      node: {
        p: { secure: 'b', flag: 'b', port: 'i', mode: { e: ['dev', 'prod'] }, url: { o: ['s', 'z'] }, tags: { a: 's' } },
        r: ['secure', 'flag', 'mode', 'url', 'tags'],
      },
      value: { secure: true, mode: 'dev', tags: [] },
      required: false,
    })
  })

  it('should resolve the default of a leaf schema', () => {
    expect(compileRuntimeConfigSchema(z.string().default('a'))).toEqual({ node: 's', value: 'a', required: false })
    expect(compileRuntimeConfigSchema(z.string().optional())).toEqual({ node: 's', value: undefined, required: false })
    expect(compileRuntimeConfigSchema(z.string())).toEqual({ node: 's', value: undefined, required: true })
  })

  it('should describe a valibot schema', () => {
    const schema = toStandardJsonSchema(v.object({ secure: v.optional(v.boolean(), true), name: v.string() }))
    expect(compileRuntimeConfigSchema(schema)).toEqual({
      node: { p: { secure: 'b', name: 's' }, r: ['name'] },
      value: { secure: true },
      required: false,
    })
  })

  it('should resolve arktype defaults, which are not part of its JSON Schema', () => {
    expect(compileRuntimeConfigSchema(type({ 'secure': 'boolean = true', 'port?': 'number' }))).toEqual({
      node: { p: { secure: 'b', port: 'n' }, r: ['secure'] },
      value: { secure: true },
      required: false,
    })
    expect(compileRuntimeConfigSchema(type({ apiKey: 'string', secure: 'boolean = true', db: { url: 'string', pool: 'number = 5' } }))).toMatchObject({
      value: { secure: true, db: { pool: 5 } },
      required: false,
    })
    expect(compileRuntimeConfigSchema(type({ token: 'string > 2', port: '1024 <= number.integer < 65536', retries: 'number = 3' }))).toMatchObject({
      value: { retries: 3 },
      required: false,
    })
  })

  it('should intersect overlapping properties of an intersection', () => {
    const schema = z.intersection(
      z.object({ mode: z.enum(['a', 'b']), db: z.object({ url: z.string() }), port: z.int() }),
      z.object({ mode: z.enum(['b', 'c']), db: z.object({ pool: z.number() }), name: z.string(), port: z.number() }),
    )
    expect(compileRuntimeConfigSchema(schema).node).toEqual({
      p: { mode: { e: ['b'] }, db: { p: { url: 's', pool: 'n' }, r: ['url', 'pool'] }, port: 'i', name: 's' },
      r: ['mode', 'db', 'port', 'name'],
    })
  })

  it('should describe a recursive schema', () => {
    const node = z.object({
      name: z.string(),
      get child () { return node.optional() },
    })
    expect(compileRuntimeConfigSchema(node)).toEqual({
      node: { p: { name: 's', child: { p: { name: 's', child: '*' }, r: ['name'] } }, r: ['name'] },
      value: {},
      required: false,
    })
  })

  it('should resolve an object schema without defaults to an object', () => {
    const schema = z.object({ apiKey: z.string(), db: z.object({ url: z.string() }), cache: z.object({ ttl: z.number() }).optional() })
    expect(compileRuntimeConfigSchema(schema)).toMatchObject({ value: { db: {} }, required: false })
  })

  it('should resolve the defaults of optional objects', () => {
    const db = z.object({ host: z.string(), port: z.number().default(5432) })
    expect(compileRuntimeConfigSchema(db.optional())).toEqual({
      node: { p: { host: 's', port: 'n' }, r: ['host', 'port'], d: { port: 5432 } },
      value: undefined,
      required: false,
    })
    expect(compileRuntimeConfigSchema(z.object({ name: z.string().default('a'), db: db.optional() }))).toEqual({
      node: { p: { name: 's', db: { p: { host: 's', port: 'n' }, r: ['host', 'port'], d: { port: 5432 } } }, r: ['name'] },
      value: { name: 'a' },
      required: false,
    })
    expect(compileRuntimeConfigSchema(type({ 'token': 'string', 'db?': { host: 'string', port: 'number = 5432' } })).node).toEqual({
      p: { db: { p: { host: 's', port: 'n' }, r: ['host', 'port'], d: { port: 5432 } }, token: 's' },
      r: ['token'],
    })
  })

  it('should resolve the defaults of object members of a union', () => {
    const storage = z.union([z.literal(false), z.object({ driver: z.string(), port: z.number().default(6379) })])
    expect(compileRuntimeConfigSchema(z.object({ storage: storage.optional() })).node).toEqual({
      p: { storage: { o: [{ e: [false] }, { p: { driver: 's', port: 'n' }, r: ['driver', 'port'], d: { port: 6379 } }] } },
    })
  })

  it('should not create optional objects from the defaults in their JSON Schema', () => {
    const schema = (required: string[]): RuntimeConfigSchema => ({
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({ issues: [{ message: 'invalid' }] }),
        jsonSchema: {
          input: () => ({}),
          output: () => ({
            type: 'object',
            properties: {
              db: { type: 'object', properties: { host: { type: 'string' }, port: { type: 'number', default: 5432 } }, required: ['host', 'port'] },
              name: { type: 'string', default: 'a' },
            },
            required,
          }),
        },
      },
    })
    expect(compileRuntimeConfigSchema(schema(['db', 'name'])).value).toEqual({ db: { port: 5432 }, name: 'a' })
    expect(compileRuntimeConfigSchema(schema(['name'])).value).toEqual({ name: 'a' })
  })

  it('should reject a schema that cannot be converted to JSON Schema', () => {
    expect(() => compileRuntimeConfigSchema(z.string().transform(value => value.length), ['length'])).toThrow('`runtimeConfig.length` cannot be converted to JSON Schema: Transforms cannot be represented in JSON Schema')
    const standardOnly = { '~standard': { version: 1, vendor: 'x', validate: (value: unknown) => ({ value }) } } as unknown as RuntimeConfigSchema
    expect(() => compileRuntimeConfigSchema(standardOnly, ['plain'])).toThrow('it does not implement Standard JSON Schema')
  })

  it('should reject a schema that validates asynchronously', () => {
    const schema = z.string().default('a').refine(() => Promise.resolve(true))
    expect(() => compileRuntimeConfigSchema(schema, ['token'])).toThrow('`runtimeConfig.token` cannot be converted to JSON Schema: it validates asynchronously')
  })
})

describe('extractRuntimeConfigSchemas', () => {
  it('should replace schemas with their defaults', () => {
    const { config, entries } = extractRuntimeConfigSchemas({
      apiSecret: z.string(),
      session: { name: 'a', secure: z.boolean().default(true) },
      public: { url: '' },
    })
    expect(config).toEqual({ session: { name: 'a', secure: true }, public: { url: '' } })
    expect(entries).toEqual([
      { path: ['apiSecret'], node: 's', required: true },
      { path: ['session', 'secure'], node: 'b', required: false },
    ])
  })

  it('should reject a schema for the whole runtime config that is not a single object', () => {
    expect(() => extractRuntimeConfigSchemas(z.union([z.object({ token: z.string() }), z.object({ mode: z.literal('a') })]))).toThrow('must describe a single object')
  })

  it('should use a value merged over a schema as its default', () => {
    const schema = z.object({ name: z.string(), secure: z.boolean().default(true) })
    const merged = mergeRuntimeConfigSchemas({ name: 'user' }, schema)
    const { config, entries } = extractRuntimeConfigSchemas({ session: merged })
    expect(config).toEqual({ session: { name: 'user', secure: true } })
    expect(entries).toEqual([{ path: ['session'], node: { p: { name: 's', secure: 'b' }, r: ['name', 'secure'] }, required: false }])

    expect(mergeRuntimeConfigSchemas(schema, { name: 'lower' })).toBe(schema)
    expect(mergeRuntimeConfigSchemas('a', 'b')).toBeUndefined()
  })
})

describe('extractModuleRuntimeConfigSchemas', () => {
  it('should use configured values as the default of a schema', () => {
    const entries: RuntimeConfigSchemaEntry[] = []
    const update = extractModuleRuntimeConfigSchemas(
      { myModule: z.object({ apiKey: z.string(), retries: z.number().default(3) }), public: { enabled: z.boolean().default(true) } },
      { myModule: { apiKey: 'user' }, public: {} },
      entries,
    )
    expect(update).toEqual({ myModule: { apiKey: 'user', retries: 3 }, public: { enabled: true } })
    expect(entries).toEqual([
      { path: ['myModule'], node: { p: { apiKey: 's', retries: 'n' }, r: ['apiKey', 'retries'] }, required: false, module: true },
      { path: ['public', 'enabled'], node: 'b', required: false, module: true },
    ])
  })

  it('should keep a schema declared in `nuxt.config`', () => {
    const entries: RuntimeConfigSchemaEntry[] = [{ path: ['token'], node: 's', required: true }]
    expect(extractModuleRuntimeConfigSchemas({ token: z.number() }, {}, entries)).toEqual({})
    expect(entries).toEqual([{ path: ['token'], node: 's', required: true }])
  })

  it('should replace a schema set by another module, with a warning', () => {
    const warn = vi.spyOn(configDiagnostics, 'NUXT_B5034').mockImplementation(() => undefined as any)
    const entries: RuntimeConfigSchemaEntry[] = [{ path: ['token'], node: 's', required: true, module: true }]
    extractModuleRuntimeConfigSchemas({ token: z.number().default(1) }, {}, entries)
    expect(entries).toEqual([{ path: ['token'], node: 'n', required: false, module: true }])
    expect(warn).toHaveBeenCalledWith({ path: 'runtimeConfig.token' })
    warn.mockRestore()
  })
})

describe('findRuntimeConfigSchema', () => {
  it('should find the path of a schema', () => {
    expect(findRuntimeConfigSchema({ a: 1, b: { c: z.string() } })).toEqual(['b', 'c'])
    expect(findRuntimeConfigSchema({ a: 1, b: { c: '' } })).toBeUndefined()
  })
})

describe('getRuntimeConfigSchema', () => {
  it('should describe values by their defaults, apart from declared schemas', () => {
    const { config, entries } = extractRuntimeConfigSchemas({
      apiSecret: z.string(),
      port: 3000,
      db: { url: z.url(), pool: 5 },
      public: { url: '' },
    })
    const schema = getRuntimeConfigSchema({ ...config as object, nitro: { envPrefix: 'NUXT_' } }, entries)
    expect(schema).toEqual({
      p: {
        port: 'n',
        db: { p: { pool: 'n', url: 's' }, r: ['url'] },
        public: { p: { url: 's' } },
        apiSecret: 's',
      },
      r: ['apiSecret'],
    })
    expect(runtimeConfigSchemaToType(schema, config)).toMatchInlineSnapshot(`
      "{
        port: number,
        db: {
          pool: number,
          url: string,
        },
        public: {
          url: string,
        },
        apiSecret: string,
      }"
    `)
  })

  it('should prefer schemas declared in `nuxt.config` over module schemas at overlapping paths', () => {
    const entries: RuntimeConfigSchemaEntry[] = [
      { path: ['myModule'], node: { p: { token: 's' }, r: ['token'] }, required: false },
      { path: ['myModule', 'token'], node: 'n', required: false, module: true },
      { path: ['myModule', 'debug'], node: 'b', required: false, module: true },
    ]
    expect(getRuntimeConfigSchema({}, entries)).toEqual({
      p: { myModule: { p: { token: 's', debug: 'b' }, r: ['token'] } },
    })
  })

  it('should let an optional schema in `nuxt.config` override a required module property', () => {
    const entries: RuntimeConfigSchemaEntry[] = [
      { path: ['myModule'], node: { p: { token: 's', debug: 'b' }, r: ['token', 'debug'] }, required: false, module: true },
      { path: ['myModule', 'token'], node: 's', required: false },
    ]
    expect(getRuntimeConfigSchema({}, entries)).toEqual({
      p: { myModule: { p: { token: 's', debug: 'b' }, r: ['debug'] } },
    })
    expect(getRuntimeConfigSchema({}, [
      { path: ['myModule', 'token'], node: 's', required: true, module: true },
      { path: ['myModule', 'debug'], node: 'b', required: true, module: true },
      { path: ['myModule'], node: { p: { token: 's' } }, required: false },
    ])).toEqual({
      p: { myModule: { p: { token: 's', debug: 'b' }, r: ['debug'] } },
    })
  })

  it('should only describe declared schemas without inference', () => {
    const { config, entries } = extractRuntimeConfigSchemas({ port: 3000, db: { url: z.url(), pool: 5 } })
    expect(getRuntimeConfigSchema(config as Record<string, unknown>, entries, { infer: false })).toEqual({
      p: { db: { p: { url: 's' }, r: ['url'] } },
    })
  })

  it('should overlay a schema for the whole runtime config', () => {
    const { config, entries } = extractRuntimeConfigSchemas(z.object({
      token: z.string().optional(),
      public: z.object({ mode: z.literal('a').default('a') }),
    }))
    const runtimeConfig = { ...config as object, app: { baseURL: '/' } }
    expect(runtimeConfigSchemaToType(getRuntimeConfigSchema(runtimeConfig, entries), runtimeConfig)).toMatchInlineSnapshot(`
      "{
        public: {
          mode: "a",
        },
        app: {
          baseURL: string,
        },
        token?: string,
      }"
    `)
  })
})
