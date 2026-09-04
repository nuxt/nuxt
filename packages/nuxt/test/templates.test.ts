import { describe, expect, it } from 'vitest'

// `templates.ts` re-imports `./app.ts`, which reads `defaultTemplates.*` at
// module init. Pulling `app.ts` in first lets that cycle resolve the same way
// it does in production; otherwise the test would see partially-initialised
// exports and crash before any assertions run.
import '../src/core/app.ts'
import { publicPathTemplate } from '../src/core/templates.ts'

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

describe('publicPathTemplate', () => {
  it('imports `useRuntimeConfig` from the bare `nitropack/runtime` specifier in production builds', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).toMatch(/import \{ useRuntimeConfig \} from ['"]nitropack\/runtime['"]/)
  })

  it('imports `useRuntimeConfig` from the specifier the server builder provides', async () => {
    const contents = await publicPathTemplate.getContents!({
      nuxt: makeNuxt({}, { runtime: { runtimeConfig: '/runtime/config.mjs' } }),
      app: makeApp(),
      options: {},
    })

    expect(contents).toMatch(/import \{ useRuntimeConfig \} from "\/runtime\/config\.mjs"/)
  })

  it('omits the runtime-config import entirely in dev mode', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt({ dev: true }), app: makeApp(), options: {} })

    expect(contents).not.toMatch(/useRuntimeConfig/)
    expect(contents).toMatch(/getAppConfig = \(\) => \(/)
  })
})
