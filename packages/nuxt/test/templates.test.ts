import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'

// `templates.ts` re-imports `./app.ts`, which reads `defaultTemplates.*` at
// module init. Pulling `app.ts` in first lets that cycle resolve the same way
// it does in production; otherwise the test would see partially-initialised
// exports and crash before any assertions run.
import '../src/core/app.ts'
import {
  appConfigTemplate,
  dollarFetchClientTemplate,
  dollarFetchTemplate,
  publicPathTemplate,
} from '../src/core/templates.ts'

import type { Nuxt, NuxtApp } from 'nuxt/schema'

function makeNuxt (overrides: Partial<Nuxt['options']> = {}): Nuxt {
  return {
    options: {
      dev: false,
      appConfig: {},
      app: { baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' },
      ...overrides,
    },
  } as unknown as Nuxt
}

function makeApp (configs: string[] = []): NuxtApp {
  return { configs } as unknown as NuxtApp
}

describe('appConfigTemplate', () => {
  it('emits an absolute path for the `defu` import so Nitro can resolve it under strict pnpm hoist', async () => {
    const contents = await appConfigTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).not.toMatch(/from ['"]defu['"]/)
    const match = contents.match(/import \{ defuFn \} from ["']([^"']+)["']/)
    expect(match, 'expected resolved `defuFn` import').toBeTruthy()
    const resolved = match![1]!
    expect(resolve(resolved)).toBe(resolved)
    expect(existsSync(resolved)).toBe(true)
  })
})

describe('publicPathTemplate', () => {
  it('imports `useRuntimeConfig` from the bare `nitro/runtime-config` specifier in production builds', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).toMatch(/import \{ useRuntimeConfig \} from ['"]nitro\/runtime-config['"]/)
  })

  it('omits the runtime-config import entirely in dev mode', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt({ dev: true }), app: makeApp(), options: {} })

    expect(contents).not.toMatch(/runtime-config/)
    expect(contents).toMatch(/getAppConfig = \(\) => \(/)
  })
})

describe('dollarFetchClientTemplate', () => {
  it('defers baseURL() until first request and keeps dynamic globalThis.fetch via _$fetch.native', async () => {
    const contents = await dollarFetchClientTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).toMatch(/import \{ \$fetch as _\$fetch, createFetch \} from ['"]ofetch['"]/)
    expect(contents).toMatch(/fetch:\s*_\$fetch\.native/)
    expect(contents).toMatch(/get baseURL\s*\(\)\s*\{/)
    expect(contents).toMatch(/\/\*#__PURE__\*\//)
    expect(contents).toMatch(/import\.meta\.test && globalThis\.\$fetch/)
    // Eager baseURL() at create time is what broke node Vitest (#35801).
    expect(contents).not.toMatch(/baseURL:\s*(?:\/\*#__PURE__\*\/\s*)?baseURL\(\)/)
  })

  it('initialises in Node without touching baseURL until a request runs', async () => {
    const contents = await dollarFetchClientTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })
    expect(contents).toContain('createFetch')

    let baseURLCalls = 0
    const baseURL = () => {
      baseURLCalls++
      return 'http://example.test'
    }

    const { $fetch: _$fetch, createFetch } = await import('ofetch')
    // Mirror the generated createFetch path (import.meta.test false / no globalThis.$fetch).
    const $fetch = createFetch({
      fetch: _$fetch.native,
      defaults: {
        get baseURL () {
          return baseURL()
        },
      },
    })

    expect(baseURLCalls).toBe(0)

    const hadWindow = 'window' in globalThis
    const previousWindow = (globalThis as { window?: unknown }).window
    if (hadWindow) {
      // @ts-expect-error intentional Node smoke
      delete globalThis.window
    }

    try {
      expect(baseURLCalls).toBe(0)

      let fetchedUrl = ''
      const previousFetch = globalThis.fetch
      globalThis.fetch = ((input: RequestInfo | URL) => {
        fetchedUrl = String(input)
        return Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } }))
      }) as typeof globalThis.fetch

      try {
        await $fetch('/api/ping')
        expect(baseURLCalls).toBe(1)
        expect(fetchedUrl).toBe('http://example.test/api/ping')

        // After init, replacing globalThis.fetch must still be observed (native wrapper).
        globalThis.fetch = ((input: RequestInfo | URL) => {
          fetchedUrl = `replaced:${String(input)}`
          return Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } }))
        }) as typeof globalThis.fetch

        await $fetch('/api/again')
        expect(fetchedUrl).toBe('replaced:http://example.test/api/again')
        expect(baseURLCalls).toBe(2)
      } finally {
        globalThis.fetch = previousFetch
      }
    } finally {
      if (hadWindow) {
        (globalThis as { window?: unknown }).window = previousWindow
      }
    }
  })
})

describe('dollarFetchTemplate', () => {
  it('keeps eager server seeding with createFetch and nitro fetch', async () => {
    const contents = await dollarFetchTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).toMatch(/import \{ createFetch \} from ['"]ofetch['"]/)
    expect(contents).toMatch(/import \{ fetch \} from ['"]nitro['"]/)
    expect(contents).toMatch(/defaults:\s*\{\s*baseURL:\s*baseURL\(\)\s*\}/)
    expect(contents).toMatch(/if\s*\(!globalThis\.\$fetch\)/)
  })
})
