import { mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Nuxt, ResolvedNuxtTemplate } from 'nuxt/schema'
import type { Unimport } from 'unimport'
import { scanDirExports } from 'unimport'
import { loadNuxt } from '../src/index.ts'

vi.mock('unimport', async (importOriginal) => {
  const unimport = await importOriginal<typeof import('unimport')>()
  return { ...unimport, scanDirExports: vi.fn(unimport.scanDirExports) }
})

const scans = vi.mocked(scanDirExports)

describe('imports rescanning', { concurrent: false, timeout: 30_000 }, async () => {
  const rootDir = join(await findWorkspaceDir(), '.test/imports-rescan')
  const composable = join(rootDir, 'app/composables/useAlpha.ts')

  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(join(rootDir, 'app/composables'), { recursive: true })
    await mkdir(join(rootDir, 'node_modules'), { recursive: true })
    await writeFile(composable, 'export const useAlpha = () => 1\n')
  })

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true, maxRetries: 3 })
  })

  async function setup (config: Record<string, any> = {}) {
    await writeFile(join(rootDir, 'nuxt.config.ts'), `export default ${JSON.stringify(config)}\n`)
    let ctx: Unimport | undefined
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: false,
    })
    nuxt.hook('imports:context', (context) => { ctx = context })
    await nuxt.ready()
    scans.mockClear()
    const names = async () => (await ctx!.getImports()).map(i => i.as || i.name)
    return { nuxt, names }
  }

  function regenerateTemplates (nuxt: Nuxt, templates: Partial<ResolvedNuxtTemplate>[]) {
    return nuxt.callHook('app:templatesGenerated', nuxt.apps.default!, templates as ResolvedNuxtTemplate[], {})
  }

  it('should rescan once for every event about the same change', async () => {
    const { nuxt, names } = await setup()

    await writeFile(composable, 'export const useBeta = () => 1\n')
    await Promise.all([
      nuxt.callHook('builder:watch', 'change', composable),
      nuxt.callHook('builder:watch', 'change', composable),
      nuxt.callHook('builder:watch', 'change', composable),
    ])
    await nuxt.callHook('builder:watch', 'change', composable)

    expect(scans).toHaveBeenCalledTimes(1)
    expect(await names()).toContain('useBeta')
    expect(await names()).not.toContain('useAlpha')
    await nuxt.close()
  })

  it('should rescan a file replaced by one with an older modification time', async () => {
    const { nuxt, names } = await setup()

    await writeFile(composable, 'export const useBeta = () => 1\n')
    await utimes(composable, new Date('2020-01-01'), new Date('2020-01-01'))
    await nuxt.callHook('builder:watch', 'change', composable)

    expect(scans).toHaveBeenCalledTimes(1)
    expect(await names()).toContain('useBeta')
    await nuxt.close()
  })

  it('should rescan once when a scanned file is removed', async () => {
    const { nuxt, names } = await setup()

    await rm(composable)
    await nuxt.callHook('builder:watch', 'unlink', composable)
    await nuxt.callHook('builder:watch', 'unlink', composable)

    expect(scans).toHaveBeenCalledTimes(1)
    expect(await names()).not.toContain('useAlpha')
    await nuxt.close()
  })

  it('should rescan when a directory of scanned files is removed', async () => {
    const dir = join(rootDir, 'app/composables/nested')
    await mkdir(dir)
    await writeFile(join(dir, 'index.ts'), 'export const useNested = () => 1\n')
    const { nuxt, names } = await setup({ imports: { dirs: ['composables/**'] } })
    expect(await names()).toContain('useNested')

    await rm(dir, { recursive: true })
    await nuxt.callHook('builder:watch', 'unlinkDir', dir)

    expect(await names()).not.toContain('useNested')
    await nuxt.close()
  })

  it('should pick up changes made while a rescan is running', async () => {
    const { nuxt, names } = await setup()
    const original = scans.getMockImplementation()!
    const releases: Array<() => void> = []
    const scanned: Array<() => void> = []
    scans.mockImplementation(async (...args) => {
      const result = await original(...args)
      scanned.shift()?.()
      await new Promise<void>(resolve => releases.push(resolve))
      return result
    })
    const nextScan = () => new Promise<void>(resolve => scanned.push(resolve))

    await writeFile(composable, 'export const useBeta = () => 1\n')
    let read = nextScan()
    const pending = nuxt.callHook('builder:watch', 'change', composable)
    await read

    await writeFile(composable, 'export const useGamma = () => 1\n')
    read = nextScan()
    const second = nuxt.callHook('builder:watch', 'change', composable)
    releases.shift()!()
    await read

    await writeFile(composable, 'export const useDelta = () => 1\n')
    read = nextScan()
    const third = nuxt.callHook('builder:watch', 'change', composable)
    releases.shift()!()
    await read
    releases.shift()!()
    await Promise.all([pending, second, third])

    scans.mockImplementation(original)
    expect(scans).toHaveBeenCalledTimes(3)
    expect(await names()).toContain('useDelta')
    await nuxt.close()
  })

  it('should reuse the last scan when other templates are regenerated', async () => {
    const { nuxt, names } = await setup()

    await regenerateTemplates(nuxt, [{ filename: 'other.mjs', dst: join(nuxt.options.buildDir, 'other.mjs'), write: true }])

    expect(scans).not.toHaveBeenCalled()
    expect(await names()).toContain('useAlpha')
    await nuxt.close()
  })

  it('should rescan when a template is written to a scanned directory', async () => {
    const { nuxt, names } = await setup()

    await writeFile(join(rootDir, 'app/composables/useGenerated.ts'), 'export const useGenerated = () => 1\n')
    const dst = `${rootDir}/app/generated/../composables/useGenerated.ts`
    await regenerateTemplates(nuxt, [{ filename: 'use-generated.ts', dst, write: true }])

    expect(scans).toHaveBeenCalledTimes(1)
    expect(await names()).toContain('useGenerated')
    await nuxt.close()
  })

  it('should rescan when every template is regenerated', async () => {
    const { nuxt, names } = await setup()

    await writeFile(join(rootDir, 'app/composables/useUnwatched.ts'), 'export const useUnwatched = () => 1\n')
    await nuxt.callHook('builder:generateApp')
    await regenerateTemplates(nuxt, [{ filename: 'other.mjs', dst: join(nuxt.options.buildDir, 'other.mjs') }])

    expect(scans).toHaveBeenCalledTimes(1)
    expect(await names()).toContain('useUnwatched')
    await nuxt.close()
  })

  it('should rescan changes in directories added with a glob', async () => {
    await mkdir(join(rootDir, 'app/stores/nested'), { recursive: true })
    const { nuxt, names } = await setup({ imports: { dirs: ['stores/**'] } })

    const store = join(rootDir, 'app/stores/nested/useStore.ts')
    await writeFile(store, 'export const useStore = () => 1\n')
    await nuxt.callHook('builder:watch', 'add', store)

    expect(scans).toHaveBeenCalledTimes(1)
    expect(await names()).toContain('useStore')
    await nuxt.close()
  })
})
