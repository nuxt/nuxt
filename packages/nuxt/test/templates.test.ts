import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'

// `templates.ts` re-imports `./app.ts`, which reads `defaultTemplates.*` at
// module init. Pulling `app.ts` in first lets that cycle resolve the same way
// it does in production; otherwise the test would see partially-initialised
// exports and crash before any assertions run.
import '../src/core/app.ts'
import { appConfigTemplate, publicPathTemplate, sharedAppConfigDeclarationTemplate } from '../src/core/templates.ts'

import type { Nuxt, NuxtApp } from 'nuxt/schema'

// deliberately partial, as the objects that reach a template in a unit test, in
// `@nuxt/test-utils` or in devtools are: `serverBuild` is only present when a caller
// supplies it, and templates have to cope either way
function makeNuxt (overrides: Partial<Nuxt['options']> = {}, serverBuild?: Partial<Nuxt['serverBuild']>): Nuxt {
  return {
    options: {
      dev: false,
      appConfig: {},
      app: { baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' },
      ...overrides,
    },
    serverBuild,
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

describe('sharedAppConfigDeclarationTemplate', () => {
  it('augments only the shared app config', async () => {
    const contents = await sharedAppConfigDeclarationTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    for (const schema of ['nuxt/schema', '@nuxt/schema']) {
      expect(contents).toContain(`declare module '${schema}' {\n  interface SharedAppConfig extends`)
    }
    expect(contents).not.toContain('interface AppConfig extends')
  })
})

describe('publicPathTemplate', () => {
  it('falls back to nitro\'s runtime-config specifier when no server build is declared', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).toMatch(/import \{ useRuntimeConfig \} from ['"]nitro\/runtime-config['"]/)
  })

  it('imports `useRuntimeConfig` from the specifier the server builder provides', async () => {
    const contents = await publicPathTemplate.getContents!({
      nuxt: makeNuxt({}, { runtime: { fetch: '/runtime/fetch.mjs', runtimeConfig: '/runtime/config.mjs' } }),
      app: makeApp(),
      options: {},
    })

    expect(contents).toMatch(/import \{ useRuntimeConfig \} from "\/runtime\/config\.mjs"/)
  })

  it('omits the runtime-config import entirely in dev mode', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt({ dev: true }), app: makeApp(), options: {} })

    expect(contents).not.toMatch(/runtime-config/)
    expect(contents).toMatch(/getAppConfig = \(\) => \(/)
  })
})
