import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const publicDir = join(tmpdir(), `nuxt-public-dirs-test-${Date.now()}`)

vi.mock('@nuxt/kit', () => ({
  useNitro: () => ({
    options: {
      publicAssets: [{ baseURL: '/', dir: publicDir }],
    },
  }),
}))

const { PublicDirsPlugin } = await import('../src/plugins/public-dirs')

beforeAll(() => {
  mkdirSync(publicDir, { recursive: true })
  writeFileSync(join(publicDir, 'logo.svg'), '<svg/>')
  writeFileSync(join(publicDir, 'icon.svg'), '<svg/>')
})

afterAll(() => {
  rmSync(publicDir, { recursive: true, force: true })
})

describe('PublicDirsPlugin dev transform', () => {
  function transformCSS (baseURL: string, code: string) {
    const plugin = PublicDirsPlugin({ dev: true, baseURL })[0]!
    const transform = typeof plugin.transform === 'function' ? plugin.transform : plugin.transform!.handler
    return (transform as any).call({}, code, '/styles.css').code.toString()
  }

  const code = 'a{background:url(/logo.svg)}b{background:url(/icon.svg)}c{background:url(/logo.svg)}'
  const expected = 'a{background:url(/cdn/logo.svg)}b{background:url(/cdn/icon.svg)}c{background:url(/cdn/logo.svg)}'

  it('prefixes every public asset url with the base URL', () => {
    expect(transformCSS('/cdn', code)).toBe(expected)
  })

  it('does not double up slashes when the base URL has a trailing slash', () => {
    expect(transformCSS('/cdn/', code)).toBe(expected)
  })
})

describe('PublicDirsPlugin', () => {
  const plugins = PublicDirsPlugin({})
  const plugin = plugins[1]!
  const resolveId = typeof plugin.resolveId === 'function' ? plugin.resolveId : plugin.resolveId!.handler
  const load = typeof plugin.load === 'function' ? plugin.load : plugin.load!.handler

  it('resolves public asset ids with a `\\0` prefix so Vite skips its fs deny check', () => {
    // see https://github.com/nuxt/nuxt/issues/35107 — Vite 7.3.2+ denies transform of
    // ids containing `.svg`/`?url`/`?raw`/`?inline` unless they start with `\0`
    const resolved = (resolveId as any).call({}, '/logo.svg', undefined, {})
    expect(resolved).toBeTypeOf('string')
    expect(resolved.startsWith('\0')).toBe(true)
    expect(resolved).toBe('\0virtual:public?' + encodeURIComponent('/logo.svg'))
  })

  it('loads the resolved virtual id back into a publicAssetsURL import', () => {
    const id = '\0virtual:public?' + encodeURIComponent('/logo.svg')
    const result = (load as any).call({}, id)
    expect(result).toContain('publicAssetsURL')
    expect(result).toContain(JSON.stringify('/logo.svg'))
  })

  describe('generateBundle', () => {
    const generateBundle = typeof plugin.generateBundle === 'function' ? plugin.generateBundle : plugin.generateBundle!.handler

    it('relativises every public asset url in an emitted stylesheet', () => {
      const bundle = {
        'assets/styles.css': {
          type: 'asset',
          source: 'a{background:url(/logo.svg)}b{background:url(/icon.svg)}c{background:url(/logo.svg)}',
        },
      }
      ;(generateBundle as any).call({}, {}, bundle)
      expect((bundle['assets/styles.css'] as any).source).toBe('a{background:url(../logo.svg)}b{background:url(../icon.svg)}c{background:url(../logo.svg)}')
    })
  })

  describe('renderChunk', () => {
    const renderChunk = typeof plugin.renderChunk === 'function' ? plugin.renderChunk : plugin.renderChunk!.handler
    const chunk = { fileName: 'chunk.js', facadeModuleId: '/app.vue?inline&used' } as any

    function render (code: string) {
      const result = (renderChunk as any).call({}, code, chunk, {}, {})
      return result?.code?.toString() ?? code
    }

    it('rewrites every public asset url in a chunk', () => {
      const code = 'const a = "a{background:url(/logo.svg)}b{background:url(/icon.svg)}c{background:url(/logo.svg)}"'
      const output = render(code)
      expect(output).not.toMatch(/url\(\//)
      expect(output.match(/publicAssetsURL\(/g)).toHaveLength(3)
    })

    it('leaves non-public urls alone', () => {
      const code = 'const a = "a{background:url(/missing.svg)}"'
      expect(render(code)).toBe(code)
    })

    it('uses the quote style of each enclosing string literal', () => {
      const code = [
        'const a = "a{background:url(/logo.svg)}"',
        'const b = \'b{background:url(/icon.svg)}\'',
      ].join('\n')
      const output = render(code)
      expect(output).toContain('"a{background:url(" + publicAssetsURL("/logo.svg") + ")}"')
      expect(output).toContain('\'b{background:url(\' + publicAssetsURL(\'/icon.svg\') + \')}\'')
    })
  })
})
