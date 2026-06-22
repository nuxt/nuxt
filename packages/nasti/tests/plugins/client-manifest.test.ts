import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Nuxt } from '@nuxt/schema'
import { logger } from '@nuxt/kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { nitroStub } = vi.hoisted(() => ({
  nitroStub: { options: { virtual: {} as Record<string, any>, _config: { virtual: {} as Record<string, any> } } },
}))

vi.mock('@nuxt/kit', async orig => ({
  ...(await orig() as object),
  useNitro: () => nitroStub,
}))

const { NastiClientManifestPlugin } = await import('../../src/plugins/client-manifest.ts')

const MANIFEST_VFS = '#build/dist/server/client.manifest.mjs'
const PRECOMPUTED_VFS = '#build/dist/server/client.precomputed.mjs'

const tmpDirs: string[] = []
function makeBuildDir () {
  const dir = mkdtempSync(join(tmpdir(), 'nuxt-nasti-cm-'))
  tmpDirs.push(dir)
  return dir
}

function createNuxt (overrides: Record<string, any> = {}) {
  return {
    options: {
      dev: true,
      buildDir: makeBuildDir(),
      app: { buildAssetsDir: '/_nuxt/' },
      features: {},
      experimental: {},
      ...overrides,
    },
    callHook: vi.fn(),
  } as unknown as Nuxt & { callHook: ReturnType<typeof vi.fn> }
}

function readVfs (name: string): string {
  return (nitroStub.options.virtual[name] as () => string)()
}

beforeEach(() => {
  nitroStub.options.virtual = {}
  nitroStub.options._config.virtual = {}
  vi.mocked(logger.warn).mockClear()
})

afterEach(() => {
  while (tmpDirs.length) {
    rmSync(tmpDirs.pop()!, { recursive: true, force: true })
  }
})

async function run (nuxt: Nuxt, clientEntry: string, config: Record<string, any> = { root: '/repo', build: {} }) {
  const plugin = NastiClientManifestPlugin(nuxt, clientEntry)
  ;(plugin.configResolved as any)?.call({}, config)
  await (plugin.closeBundle as any).call({})
  return plugin
}

describe('NastiClientManifestPlugin', () => {
  it('registers the manifest virtuals on both nitro virtual maps', () => {
    NastiClientManifestPlugin(createNuxt(), '/repo/.nuxt/entry.mjs')

    for (const name of [MANIFEST_VFS, PRECOMPUTED_VFS]) {
      expect(nitroStub.options.virtual[name]).toBeTypeOf('function')
      expect(nitroStub.options._config.virtual[name]).toBeTypeOf('function')
    }
  })

  it('applies to the ssr environment only', () => {
    const plugin = NastiClientManifestPlugin(createNuxt(), '/repo/.nuxt/entry.mjs')
    expect(plugin.applyToEnvironment?.({ name: 'ssr' } as any)).toBe(true)
    expect(plugin.applyToEnvironment?.({ name: 'client' } as any)).toBe(false)
  })

  it('emits a synthetic dev manifest and fires build:manifest', async () => {
    const nuxt = createNuxt({ dev: true })
    const entry = '/repo/.nuxt/entry.mjs'
    await run(nuxt, entry)

    const manifest = readVfs(MANIFEST_VFS)
    expect(manifest).toContain('@nasti/client')
    expect(manifest).toContain(entry)
    expect(readVfs(PRECOMPUTED_VFS)).toContain('export default')
    expect((nuxt as any).callHook).toHaveBeenCalledWith('build:manifest', expect.any(Object))
  })

  it('omits the client entry when scripts are disabled', async () => {
    const nuxt = createNuxt({ dev: true, features: { noScripts: 'all' } })
    const entry = '/repo/.nuxt/entry.mjs'
    await run(nuxt, entry)

    const manifest = readVfs(MANIFEST_VFS)
    expect(manifest).toContain('@nasti/client')
    expect(manifest).not.toContain(entry)
  })

  it('warns and falls back to a synthetic manifest when production has no manifest.json', async () => {
    const nuxt = createNuxt({ dev: false })
    await run(nuxt, '/repo/.nuxt/entry.mjs')

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('did not emit a client `manifest.json`'),
    )
    expect(readVfs(MANIFEST_VFS)).toContain('@nasti/client')
  })

  it('strips the buildAssetsDir prefix and removes the source manifest.json in production', async () => {
    const nuxt = createNuxt({ dev: false })
    const clientDist = join((nuxt.options as any).buildDir, 'dist/client')
    mkdirSync(clientDist, { recursive: true })
    const manifestFile = join(clientDist, 'manifest.json')
    writeFileSync(manifestFile, JSON.stringify({
      'entry.mjs': { isEntry: true, file: '_nuxt/entry.abc.js', css: ['_nuxt/entry.css'] },
    }))

    await run(nuxt, '/repo/.nuxt/entry.mjs')

    const manifest = readVfs(MANIFEST_VFS)
    expect(manifest).toContain('entry.abc.js')
    expect(manifest).not.toContain('_nuxt/entry.abc.js')
    expect(manifest).toContain('entry.css')
    expect(existsSync(manifestFile)).toBe(false)
  })

  it('writes build-cache copies when experimental.buildCache is on', async () => {
    const nuxt = createNuxt({ dev: false, experimental: { buildCache: true } })
    await run(nuxt, '/repo/.nuxt/entry.mjs')

    const serverDist = join((nuxt.options as any).buildDir, 'dist/server')
    expect(existsSync(join(serverDist, 'client.manifest.mjs'))).toBe(true)
    expect(existsSync(join(serverDist, 'client.precomputed.mjs'))).toBe(true)
  })
})
