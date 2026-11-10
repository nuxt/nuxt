import { existsSync } from 'node:fs'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { resolve } from 'pathe'
import ts from 'typescript'

// `templates.ts` re-imports `./app.ts`, which reads `defaultTemplates.*` at
// module init. Pulling `app.ts` in first lets that cycle resolve the same way
// it does in production; otherwise the test would see partially-initialised
// exports and crash before any assertions run.
import '../src/core/app.ts'
import { appConfigDeclarationTemplate, appConfigTemplate, dollarFetchClientTemplate, dollarFetchSetupClientTemplate, dollarFetchSetupServerTemplate, dollarFetchTemplate, publicPathTemplate, schemaTemplate, sharedAppConfigDeclarationTemplate } from '../src/core/templates.ts'

import type { Nuxt, NuxtApp } from 'nuxt/schema'
import type { RuntimeConfigSchemaNode } from '@nuxt/schema/internal'

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
  it('does not merge at runtime when there are no app config layers', async () => {
    const contents = await appConfigTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).not.toContain('defuFn')
    expect(contents).toContain('export default inlineConfig')
  })

  it('merges the layers it is given at runtime', async () => {
    const contents = await appConfigTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(['/app/app.config.ts']), options: {} })

    expect(contents).toContain('export default /*@__PURE__*/ defuFn(cfg0, inlineConfig)')
  })

  it('emits an absolute path for the `defu` import so Nitro can resolve it under strict pnpm hoist', async () => {
    const contents = await appConfigTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(['/app/app.config.ts']), options: {} })

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

describe.each([
  ['appConfigDeclarationTemplate', appConfigDeclarationTemplate],
  ['sharedAppConfigDeclarationTemplate', sharedAppConfigDeclarationTemplate],
])('%s', (_name, template) => {
  const render = (appConfig: Record<string, unknown>) => template.getContents!({ nuxt: makeNuxt({ appConfig } as Partial<Nuxt['options']>), app: makeApp(), options: {} })

  it('does not change when only inline app config values change', async () => {
    const first = await render({ time: 1, sha: 'abc', enabled: true, empty: null, list: [1, 2], items: [{ id: 'a' }, { id: 'b' }] })
    const second = await render({ time: 2, sha: 'def', enabled: false, empty: null, list: [3], items: [{ id: 'c' }] })
    expect(second).toBe(first)
    expect(first).not.toContain('abc')
  })

  it('changes when the shape of the inline app config changes', async () => {
    const first = await render({ time: 1, list: [1] })
    expect(await render({ time: '1', list: [1] })).not.toBe(first)
    expect(await render({ time: 1, list: [1, 'a'] })).not.toBe(first)
    expect(await render({ time: 1, list: [1], extra: true })).not.toBe(first)
  })
})

describe('publicPathTemplate', () => {
  it('falls back to the host nitro major\'s runtime-config specifier when no server build is declared', async () => {
    const v3 = await publicPathTemplate.getContents!({ nuxt: makeNuxt({ _nitroMajor: 3 }), app: makeApp(), options: {} })
    expect(v3).toMatch(/import \{ useRuntimeConfig \} from ['"]nitro\/runtime-config['"]/)

    const v2 = await publicPathTemplate.getContents!({ nuxt: makeNuxt({ _nitroMajor: 2 }), app: makeApp(), options: {} })
    expect(v2).toMatch(/import \{ useRuntimeConfig \} from ['"]nitropack\/runtime['"]/)
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

  it('builds server asset urls from the current runtime config', async () => {
    const { joinRelativeURL } = await import('ufo')
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })
    const source = contents
      .replace(/^import .*$/gm, '')
      .replace(/\bexport /g, '')
      .replace(/import\.meta\.(server|client)/g, (_, env) => String(env === 'server'))
    vi.stubGlobal('__TEST_SERVER__', true)
    onTestFinished(() => { vi.unstubAllGlobals() })
    let app = { baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' }
    const join = vi.fn(joinRelativeURL)
    const buildAssetsURL = new Function('joinRelativeURL', 'useRuntimeConfig', `${source}\nreturn buildAssetsURL`)(join, () => ({ app })) as (...path: string[]) => string

    expect(buildAssetsURL('entry.js')).toBe('/_nuxt/entry.js')
    expect(buildAssetsURL('entry.js')).toBe('/_nuxt/entry.js')
    expect(join).toHaveBeenCalledTimes(1)
    app = { ...app, baseURL: '/base/' }
    expect(buildAssetsURL('entry.js')).toBe('/base/_nuxt/entry.js')
    app = { ...app, cdnURL: 'https://cdn.example.com/' }
    expect(buildAssetsURL('entry.js')).toBe('https://cdn.example.com/_nuxt/entry.js')
    app = { ...app, buildAssetsDir: '/assets/' }
    expect(buildAssetsURL('entry.js')).toBe('https://cdn.example.com/assets/entry.js')
    expect(buildAssetsURL('chunks', 'entry.js')).toBe('https://cdn.example.com/assets/chunks/entry.js')
    expect(buildAssetsURL()).toBe('https://cdn.example.com/assets/')
  })
})

describe('dollarFetchTemplate', () => {
  it('backs `$fetch` with the `fetch` the server builder provides', async () => {
    const contents = await dollarFetchTemplate.getContents!({
      nuxt: makeNuxt({}, { runtime: { fetch: '/runtime/fetch.mjs', runtimeConfig: '/runtime/config.mjs' } }),
      app: makeApp(),
      options: {},
    })

    expect(contents).toMatch(/import \{ fetch \} from "\/runtime\/fetch\.mjs"/)
    expect(contents).toMatch(/createFetch\(\{\s*fetch,/)
  })

  it('falls back to `ofetch` when the server runtime declares no `fetch` module', async () => {
    const contents = await dollarFetchTemplate.getContents!({
      nuxt: makeNuxt({}, { runtime: { runtimeConfig: 'nitropack/runtime' } }),
      app: makeApp(),
      options: {},
    })

    expect(contents).not.toMatch(/import \{ fetch \}/)
    expect(contents).not.toMatch(/createFetch/)
    expect(contents).toMatch(/import \{ \$fetch as _\$fetch \} from ['"]ofetch['"]/)
    expect(contents).toMatch(/globalThis\.\$fetch = _\$fetch\.create\(\{\s*baseURL: baseURL\(\)/)
  })
})

describe('client `$fetch` templates', () => {
  it('installs the global only when the binding is read', async () => {
    const contents = await dollarFetchClientTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).toContain('export const $fetch = /*#__PURE__*/ (() => globalThis.$fetch ||= _$fetch.create({ baseURL: baseURL() }))()')
    expect(contents).not.toMatch(/^if /m)
  })

  it('installs the global from the entry in development only', async () => {
    expect(await dollarFetchSetupClientTemplate.getContents!({ nuxt: makeNuxt({ dev: true }), app: makeApp(), options: {} })).toContain('#build/fetch-global')
    expect(await dollarFetchSetupClientTemplate.getContents!({ nuxt: makeNuxt({ experimental: {} } as Partial<Nuxt['options']>), app: makeApp(), options: {} })).not.toContain('#build/fetch')
    expect(await dollarFetchSetupClientTemplate.getContents!({ nuxt: makeNuxt({ experimental: { globalFetch: true } } as Partial<Nuxt['options']>), app: makeApp(), options: {} })).toContain('#build/fetch-global')
    expect(await dollarFetchSetupServerTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })).toContain('#build/fetch')
  })
})

describe('schemaTemplate', () => {
  it('emits valid declarations for a public runtime config schema that is a union', async () => {
    const node: RuntimeConfigSchemaNode = { o: [{ p: { mode: { e: ['preview'] } } }, { p: { mode: { e: ['production'] } } }] }
    const runtimeConfig = { apiKey: '', public: { mode: 'preview' } }
    const contents = await schemaTemplate.getContents!({
      nuxt: makeNuxt({ runtimeConfig, _runtimeConfigSchemas: [{ path: ['public'], node, required: false }] } as unknown as Partial<Nuxt['options']>),
      app: makeApp(),
      options: {},
    })
    expect(ts.transpileModule(contents, { reportDiagnostics: true }).diagnostics).toEqual([])
    expect(contents).toContain('interface SharedRuntimeConfig {\n  apiKey: string,\n}')
  })
})
