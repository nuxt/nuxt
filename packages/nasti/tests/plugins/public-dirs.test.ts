import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const publicDir = join(tmpdir(), `nuxt-nasti-public-dirs-test-${process.pid}`)

vi.mock('@nuxt/kit', () => ({
  useNitro: () => ({
    options: {
      publicAssets: [{ baseURL: '/', dir: publicDir }],
    },
  }),
}))

const { PublicDirsPlugin, useResolveFromPublicAssets } = await import('../../src/plugins/public-dirs.ts')

beforeAll(() => {
  mkdirSync(publicDir, { recursive: true })
  writeFileSync(join(publicDir, 'logo.svg'), '<svg/>')
})

afterAll(() => {
  rmSync(publicDir, { recursive: true, force: true })
})

describe('useResolveFromPublicAssets', () => {
  const { resolveFromPublicAssets } = useResolveFromPublicAssets()

  it('resolves an existing public asset', () => {
    expect(resolveFromPublicAssets('/logo.svg')).toBe('/logo.svg')
    // the query is stripped only for the filesystem lookup; the returned id keeps it.
    expect(resolveFromPublicAssets('/logo.svg?foo=1')).toBe('/logo.svg?foo=1')
  })

  it('returns undefined for missing or non-public ids', () => {
    expect(resolveFromPublicAssets('/missing.png')).toBeUndefined()
    expect(resolveFromPublicAssets('https://example.com/x.svg')).toBeUndefined()
  })
})

describe('PublicDirsPlugin resolution', () => {
  const plugin = PublicDirsPlugin({})[1]!
  const resolveId = plugin.resolveId as any
  const load = plugin.load as any
  const generateBundle = plugin.generateBundle as any

  it('resolves public asset ids to a `\\0`-prefixed virtual id', () => {
    const resolved = resolveId.call({}, '/logo.svg')
    expect(resolved).toBe('\0virtual:public?' + encodeURIComponent('/logo.svg'))
  })

  it('skips bare specifiers, /@fs paths and the dev skip marker', () => {
    expect(resolveId.call({}, 'vue')).toBeUndefined()
    expect(resolveId.call({}, '/@fs/x/logo.svg')).toBeUndefined()
    expect(resolveId.call({}, '/__skip_nasti')).toBeUndefined()
    expect(resolveId.call({}, '/missing.png')).toBeUndefined()
  })

  it('loads the virtual id into a publicAssetsURL import', () => {
    const id = '\0virtual:public?' + encodeURIComponent('/logo.svg')
    const result = load.call({}, id) as string
    expect(result).toContain('publicAssetsURL')
    expect(result).toContain(JSON.stringify('/logo.svg'))
  })

  it('does not load non-virtual ids', () => {
    expect(load.call({}, '/logo.svg')).toBeUndefined()
  })

  it('rewrites public asset urls in emitted CSS to relative paths', () => {
    const bundle = {
      'assets/style.css': {
        type: 'asset',
        source: 'a{background:url(/logo.svg)} b{background:url(/missing.png)}',
      },
    }
    generateBundle.call({}, {}, bundle)

    expect(bundle['assets/style.css'].source).toContain('url(../logo.svg)')
    expect(bundle['assets/style.css'].source).toContain('url(/missing.png)')
  })
})

describe('PublicDirsPlugin dev css rewrite', () => {
  it('only applies on serve when a non-root baseURL is configured', () => {
    expect(PublicDirsPlugin({ dev: true, baseURL: '/x/' })[0]!.apply).toBe('serve')
    expect(PublicDirsPlugin({ dev: true, baseURL: '/' })[0]!.apply).toBeTypeOf('function')
    expect(PublicDirsPlugin({ dev: false, baseURL: '/x/' })[0]!.apply).toBeTypeOf('function')
  })

  it('prefixes public asset urls with the baseURL', () => {
    const devPlugin = PublicDirsPlugin({ dev: true, baseURL: '/x/' })[0]!
    const transform = devPlugin.transform as any
    const out = transform.call({}, 'a{background:url(/logo.svg)}', 'styles.css')
    expect(out?.code).toContain('url(/x//logo.svg)')
  })

  it('ignores non-css modules', () => {
    const devPlugin = PublicDirsPlugin({ dev: true, baseURL: '/x/' })[0]!
    expect((devPlugin.transform as any).call({}, 'url(/logo.svg)', 'app.ts')).toBeUndefined()
  })
})
