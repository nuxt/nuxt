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
})

afterAll(() => {
  rmSync(publicDir, { recursive: true, force: true })
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
})
