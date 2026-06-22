import type { Nuxt } from '@nuxt/schema'
import { describe, expect, it } from 'vitest'
import { ssrEnvironment } from '../../src/config/server.ts'

function createNuxt (overrides: Record<string, any> = {}) {
  return {
    options: {
      sourcemap: { server: true },
      ...overrides,
    },
  } as unknown as Nuxt
}

describe('ssrEnvironment', () => {
  it('describes a server consumer with the given entry and ESM output', () => {
    const env = ssrEnvironment(createNuxt(), '/repo/.nuxt/entry-server.mjs')

    expect(env.consumer).toBe('server')
    expect(env.entry).toBe('/repo/.nuxt/entry-server.mjs')
    expect(env.resolve?.conditions).toEqual(['node', 'import', 'module', 'default'])
    expect(env.build?.rolldownOptions?.output).toMatchObject({ format: 'es' })
    expect(env.build?.minify).toBe(false)
  })

  it('forwards the server sourcemap option', () => {
    expect(ssrEnvironment(createNuxt({ sourcemap: { server: true } }), '/e').build?.sourcemap).toBe(true)
    expect(ssrEnvironment(createNuxt({ sourcemap: { server: false } }), '/e').build?.sourcemap).toBe(false)
    expect(ssrEnvironment(createNuxt({ sourcemap: {} }), '/e').build?.sourcemap).toBeUndefined()
  })

  it('keeps Node built-ins external in both bare and `node:` forms, without duplicates', () => {
    const external = ssrEnvironment(createNuxt(), '/e').build?.rolldownOptions?.external as string[]

    expect(external).toContain('fs')
    expect(external).toContain('node:fs')
    expect(external).toContain('path')
    expect(external).toContain('node:path')
    expect(new Set(external).size).toBe(external.length)
  })

  it('exposes the unenv polyfill alias map for non-Node presets', () => {
    const env = ssrEnvironment(createNuxt(), '/e')
    expect(env.resolve?.alias).toBeTypeOf('object')
    expect(Object.keys(env.resolve!.alias as Record<string, string>).length).toBeGreaterThan(0)
  })
})
