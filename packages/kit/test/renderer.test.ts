import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import { getRendererConfig, getRendererDefines } from '../src/internal/renderer.ts'

function nuxt (options: Record<string, any> = {}): Nuxt {
  return {
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
      ...options,
    },
  } as unknown as Nuxt
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
