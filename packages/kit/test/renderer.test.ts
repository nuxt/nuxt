import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { NuxtServerBuildRuntime } from '@nuxt/schema/internal'

import { SERVER_RUNTIME_VERSION, getRendererConfig, getRendererDefines, getServerRuntime } from '../src/internal/renderer.ts'
import { createServerBuild } from '../src/internal/server-build.ts'

function nuxt (options: Record<string, any> = {}): Nuxt {
  const { buildOutputs, ...rest } = options
  return {
    buildOutputs,
    options: {
      dev: false,
      ssr: true,
      appId: 'nuxt-app',
      app: {
        head: { title: 'app' },
        rootTag: 'div',
        rootAttrs: { id: '__nuxt' },
        teleportTag: 'div',
        teleportAttrs: { id: 'teleports' },
        spaLoaderTag: 'div',
        spaLoaderAttrs: { id: '__nuxt-loader' },
      },
      experimental: {},
      features: {},
      future: {},
      unhead: {},
      ...rest,
    },
  } as unknown as Nuxt
}

function withServerRuntime (instance: Nuxt, runtime: Partial<NuxtServerBuildRuntime>): Nuxt {
  instance.serverBuild = createServerBuild(instance.options)
  Object.assign(instance.serverBuild.runtime, runtime)
  return instance
}

function exportedNames (code: string) {
  return code.split('\n').flatMap((line) => {
    const declared = /^export const (\w+)/.exec(line)
    if (declared) { return [declared[1]!] }
    const reExported = /^export \{ (.+) \} from/.exec(line)
    return reExported ? reExported[1]!.split(',').map(name => name.trim().split(' as ').pop()!) : []
  })
}

describe('getRendererConfig', () => {
  it('provides every constant the renderer reads', () => {
    const stub = readFileSync(new URL('../../nuxt/src/runtime/server/renderer-config.ts', import.meta.url), 'utf-8')
    const expected = [...stub.matchAll(/^export const (\w+)/gm)].map(match => match[1])

    expect(exportedNames(getRendererConfig({}, nuxt())).sort()).toEqual(expected.sort())
  })

  it('derives what it can from the resolved configuration', () => {
    const code = getRendererConfig({}, nuxt({
      ssr: false,
      features: { inlineStyles: true, noScripts: 'production' },
      experimental: { payloadExtraction: true, spaLoadingTemplateLocation: 'body' },
    }))

    expect(code).toContain('export const NUXT_NO_SSR = true')
    expect(code).toContain('export const NUXT_INLINE_STYLES = true')
    expect(code).toContain('export const NUXT_NO_SCRIPTS_PROD = true')
    expect(code).toContain('export const NUXT_PAYLOAD_INLINE = false')
    expect(code).toContain('export const spaLoadingTemplateOutside = true')
    expect(code).toContain('export const appRootAttrs = {"id":"__nuxt"}')
  })

  it('defaults the constants a server builder resolves for itself, and takes overrides', () => {
    const code = getRendererConfig({ overrides: { componentIslands: 'true', spaTemplate: '"<span/>"' } }, nuxt())

    expect(code).toContain('export const NUXT_PAGE_MATCHER = undefined')
    expect(code).toContain('export const NUXT_EARLY_404 = false')
    expect(code).toContain('export const componentIslands = true')
    expect(code).toContain('export const spaTemplate = "<span/>"')
  })

  it('re-exports the head module templates rather than inlining their values', () => {
    const code = getRendererConfig({}, nuxt())

    expect(code).toContain(`export { default as unheadOptions } from "#build/unhead-options.mjs"`)
    expect(code).toContain(`export { iifeChunkFileName, renderSSRHeadOptions } from "#build/unhead.config.mjs"`)

    expect(getRendererConfig({ unheadOptions: '#custom', headConfig: '#custom-config' }, nuxt())).toContain(`from "#custom-config"`)
  })
})

describe('getServerRuntime', () => {
  const runtimeDir = new URL('../../nuxt/src/runtime/server/', import.meta.url)

  function buildOutputs () {
    return {
      serverEntry: () => 'export default {}',
      ssrStyles: () => 'export default {}',
      clientManifest: () => 'export default {}',
      clientPrecomputed: () => 'export default undefined',
      entryChunkName: () => 'export const entryFileName = undefined',
      entryIds: () => 'export default []',
    }
  }

  it('provides a module for every stub a builder must replace', () => {
    // every module at the root of the server runtime tree is a stub whose real body only
    // the build knows, so each one must be in the record for a builder to find it. Not
    // `server-default`, which is how a builder reaches the shipped `nuxt/server` bodies.
    const stubs = readdirSync(runtimeDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'server-default.ts')
      .map(entry => `nuxt/internal/${entry.name.replace(/\.ts$/, '')}`)

    const { modules } = getServerRuntime({}, nuxt({ buildOutputs: buildOutputs() }))

    expect(Object.keys(modules).sort()).toEqual([...stubs, 'nuxt/server'].sort())
  })

  it('reads each module body lazily, and names the build output backing it', async () => {
    const outputs = buildOutputs()
    let manifest = 'export default {}'
    outputs.clientManifest = () => manifest

    const { modules, version, entry } = getServerRuntime({}, nuxt({ buildOutputs: outputs }))

    expect(version).toBe(SERVER_RUNTIME_VERSION)
    expect(entry).toBe('nuxt/internal/renderer')

    manifest = 'export default { entry: {} }'
    expect(await modules['nuxt/internal/manifest']!.code()).toBe(manifest)
    expect(modules['nuxt/internal/manifest']!.output).toBe('clientManifest')
    expect(modules['nuxt/internal/renderer-config']!.output).toBeUndefined()
  })

  it('resolves the renderer config overrides each time the module is read', async () => {
    let template = '""'
    const { modules } = getServerRuntime({ overrides: () => ({ spaTemplate: template }) }, nuxt({ buildOutputs: buildOutputs() }))

    template = '"<span/>"'
    expect(await modules['nuxt/internal/renderer-config']!.code()).toContain('export const spaTemplate = "<span/>"')
  })

  it('folds the renderer against the phase the bundle renders in', () => {
    expect(getServerRuntime({ phase: 'prerender' }, nuxt({ buildOutputs: buildOutputs() })).defines).toMatchObject({
      'import.meta.prerender': 'true',
    })
  })

  it('backs it with the shipped implementations, and with a builder\'s where it supplies them', async () => {
    const withoutDelegate = nuxt({ buildOutputs: buildOutputs() })
    const shipped = await getServerRuntime({}, withoutDelegate).modules['nuxt/server']!.code()
    expect(shipped).toMatch(/^export \* from "\S+server[/\\]index\.ts"$/)

    const withDelegate = withServerRuntime(nuxt({ buildOutputs: buildOutputs() }), { server: '/delegate.mjs' })
    expect(await getServerRuntime({}, withDelegate).modules['nuxt/server']!.code()).toBe('export * from "/delegate.mjs"')
  })

  it('reads runtime configuration from the module the server builder provides it in', async () => {
    const instance = withServerRuntime(nuxt({ buildOutputs: buildOutputs() }), { runtimeConfig: '#my-server/config' })

    expect(await getServerRuntime({}, instance).modules['nuxt/internal/server-runtime-config']!.code())
      .toBe('export { useRuntimeConfig } from "#my-server/config"')
  })
})

describe('getRendererDefines', () => {
  it('folds the renderer against the phase it is built for', () => {
    expect(getRendererDefines('server', nuxt())).toMatchObject({
      'import.meta.dev': 'false',
      'import.meta.server': 'true',
      'import.meta.client': 'false',
      'import.meta.prerender': 'false',
    })
    expect(getRendererDefines('prerender', nuxt({ dev: true }))).toMatchObject({
      'import.meta.dev': 'true',
      'import.meta.prerender': 'true',
    })
  })
})
