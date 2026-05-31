import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'

// `templates.ts` re-imports `./app.ts`, which reads `defaultTemplates.*` at
// module init. Pulling `app.ts` in first lets that cycle resolve the same way
// it does in production; otherwise the test would see partially-initialised
// exports and crash before any assertions run.
import '../src/core/app.ts'
import { appConfigTemplate, publicPathTemplate } from '../src/core/templates.ts'

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
  it('emits an absolute path for `nitro/runtime-config` in production builds', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).not.toMatch(/from ['"]nitro\/runtime-config['"]/)
    const match = contents.match(/import \{ useRuntimeConfig \} from ["']([^"']+)["']/)
    expect(match, 'expected resolved `useRuntimeConfig` import').toBeTruthy()
    const resolved = match![1]!
    expect(resolve(resolved)).toBe(resolved)
    expect(existsSync(resolved)).toBe(true)
    expect(resolved).toMatch(/runtime-config/)
  })

  it('omits the runtime-config import entirely in dev mode', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt({ dev: true }), app: makeApp(), options: {} })

    expect(contents).not.toMatch(/runtime-config/)
    expect(contents).toMatch(/getAppConfig = \(\) => \(/)
  })
})
