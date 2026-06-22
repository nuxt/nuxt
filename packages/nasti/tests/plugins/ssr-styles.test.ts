import type { Nuxt } from '@nuxt/schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { nitroStub } = vi.hoisted(() => ({
  nitroStub: { options: { virtual: {} as Record<string, any>, _config: { virtual: {} as Record<string, any> } } },
}))

vi.mock('@nuxt/kit', () => ({
  useNitro: () => nitroStub,
}))

const { SSRStylesPlugin } = await import('../../src/plugins/ssr-styles.ts')

const STYLES_VFS = '#build/dist/server/styles.mjs'

function createNuxt (overrides: Record<string, any> = {}) {
  return {
    options: {
      dev: false,
      features: { inlineStyles: true },
      ...overrides,
    },
  } as unknown as Nuxt
}

function makeCtx () {
  return {
    emitFile: vi.fn(() => 'REF'),
    getFileName: vi.fn(() => 'Foo-styles.abc.mjs'),
  }
}

beforeEach(() => {
  nitroStub.options.virtual = {}
  nitroStub.options._config.virtual = {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SSRStylesPlugin gating', () => {
  it('is disabled in dev', () => {
    expect(SSRStylesPlugin(createNuxt({ dev: true }))).toBeUndefined()
  })

  it('is disabled when inlineStyles is off', () => {
    expect(SSRStylesPlugin(createNuxt({ features: { inlineStyles: false } }))).toBeUndefined()
    expect(SSRStylesPlugin(createNuxt({ features: {} }))).toBeUndefined()
  })
})

describe('SSRStylesPlugin', () => {
  it('registers the styles manifest virtual and applies to ssr only', () => {
    const plugin = SSRStylesPlugin(createNuxt())!

    expect(nitroStub.options.virtual[STYLES_VFS]).toBeTypeOf('function')
    expect(nitroStub.options._config.virtual[STYLES_VFS]).toBeTypeOf('function')
    expect(plugin.applyToEnvironment?.({ name: 'ssr' } as any)).toBe(true)
    expect(plugin.applyToEnvironment?.({ name: 'client' } as any)).toBe(false)
  })

  it('inlines each CSS asset into a styles chunk and maps it in the manifest', () => {
    const plugin = SSRStylesPlugin(createNuxt())!
    const ctx = makeCtx()
    const bundle = {
      'assets/Foo.css': { type: 'asset', name: 'Foo.css', source: '.a{color:red}' },
      'assets/empty.css': { type: 'asset', name: 'empty.css', source: '' },
      'assets/app.js': { type: 'chunk', code: 'x' },
    }

    ;(plugin.generateBundle as any).call(ctx, {}, bundle)

    expect(ctx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.emitFile).toHaveBeenCalledWith(expect.objectContaining({
      type: 'asset',
      name: 'Foo-styles.mjs',
      source: expect.stringContaining('.a{color:red}'),
    }))

    const manifest = (nitroStub.options.virtual[STYLES_VFS] as () => string)()
    expect(manifest).toContain('"Foo"')
    expect(manifest).toContain(`import('./Foo-styles.abc.mjs')`)
  })

  it('decodes a Uint8Array CSS source', () => {
    const plugin = SSRStylesPlugin(createNuxt())!
    const ctx = makeCtx()
    const bundle = {
      'assets/Bar.css': { type: 'asset', name: 'Bar.css', source: new TextEncoder().encode('.b{}') },
    }

    ;(plugin.generateBundle as any).call(ctx, {}, bundle)

    expect(ctx.emitFile).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.stringContaining('.b{}'),
    }))
  })
})
