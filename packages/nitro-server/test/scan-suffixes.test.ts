import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitro/types'

import { findRejectedScanSuffixes, loadParseScanPath, setupScanSuffixes } from '../src/scan-suffixes.ts'
import { resolveNitroLegacyOptions } from '../src/compat.ts'
import { nitroBuildDiagnostics } from '../src/diagnostics.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

function silence (code: 'NUXT_B9013' | 'NUXT_B9014') {
  return vi.spyOn(nitroBuildDiagnostics, code).mockImplementation(() => ({}) as any)
}

function createProject (files: string[]) {
  const rootDir = mkdtempSync(join(tmpdir(), 'nitro-scan-suffixes-'))
  onTestFinished(() => rmSync(rootDir, { recursive: true, force: true }))
  for (const file of files) {
    mkdirSync(dirname(join(rootDir, file)), { recursive: true })
    writeFileSync(join(rootDir, file), 'export default () => {}\n')
  }
  return rootDir
}

function createNuxt (rootDir: string, options: Record<string, any> = {}) {
  const hooks = createHooks()
  return {
    hooks,
    hook: hooks.hook,
    callHook: hooks.callHook,
    options: {
      rootDir,
      srcDir: rootDir,
      serverDir: join(rootDir, 'server'),
      dev: false,
      ignore: [],
      _layers: [{ config: { rootDir, srcDir: rootDir }, cwd: rootDir }],
      ...options,
    },
  } as unknown as Nuxt
}

const npmxFiles = [
  'server/middleware/canonical-redirects.global.ts',
  'server/routes/.well-known/site.standard.publication.get.ts',
]

describe('loadParseScanPath', () => {
  it('loads the file name parser of the installed nitro', async () => {
    const parse = await loadParseScanPath()
    expect(parse).toBeTypeOf('function')
    const nitro = { options: { dev: true, scanSuffixes: [] }, logger: { error: () => {} } }
    expect(parse!(nitro, { dir: 'routes', path: 'sitemap.xml.get.ts' }, { method: true, env: true })).toMatchObject({ name: 'sitemap.xml', method: 'get' })
    expect(parse!(nitro, { dir: 'middleware', path: 'stamp.global.ts' })).toBeUndefined()
  })
})

describe('findRejectedScanSuffixes', () => {
  it('finds the suffixes nitro rejects in every directory it scans by file name', async () => {
    const rootDir = createProject([
      ...npmxFiles,
      'server/api/users.recent.ts',
      'server/plugins/sentry.server.ts',
      'server/tasks/db.migrate.ts',
      'server/modules/feature.flags.ts',
      'server/modules/nested/deep.module.ts',
      'server/middleware/auth.get.ts',
    ])
    const parse = (await loadParseScanPath())!
    const options = { scanDirs: [join(rootDir, 'server')] }

    const found = findRejectedScanSuffixes(createNuxt(rootDir), options, parse)
    expect(found.map(({ path, suffix }) => [path.slice(rootDir.length + 1), suffix]).sort()).toEqual([
      ['server/api/users.recent.ts', 'recent'],
      ['server/middleware/auth.get.ts', 'get'],
      ['server/middleware/canonical-redirects.global.ts', 'global'],
      ['server/modules/feature.flags.ts', 'flags'],
      ['server/plugins/sentry.server.ts', 'server'],
      ['server/routes/.well-known/site.standard.publication.get.ts', 'publication'],
    ])

    expect(findRejectedScanSuffixes(createNuxt(rootDir), { ...options, experimental: { tasks: true } }, parse).map(entry => entry.suffix)).toContain('migrate')
  })

  it('leaves out names nitro accepts and files nitro does not scan', async () => {
    const rootDir = createProject([
      'server/routes/sitemap.xml.ts',
      'server/routes/[...slug].get.ts',
      'server/routes/report.post.prod.ts',
      'server/routes/1.first.ts',
      'server/routes/handler.test.ts',
      'server/routes/types.d.ts',
      'server/routes/notes.global.md',
      'server/utils/format.date.ts',
    ])

    expect(findRejectedScanSuffixes(createNuxt(rootDir), { scanDirs: [join(rootDir, 'server')] }, (await loadParseScanPath())!)).toEqual([])
  })

  it('leaves out files `nitro.ignore` excludes from the scan', async () => {
    const rootDir = createProject([...npmxFiles, 'server/api/drafts/feed.custom.ts'])

    const found = findRejectedScanSuffixes(createNuxt(rootDir), { scanDirs: [join(rootDir, 'server')], ignore: ['middleware/canonical-redirects.global.ts', '**/drafts/**'] }, (await loadParseScanPath())!)
    expect(found).toEqual([{ path: join(rootDir, 'server/routes/.well-known/site.standard.publication.get.ts'), suffix: 'publication' }])
  })

  it('follows symbolic links to files, as nitro does', async () => {
    const rootDir = createProject(['shared/stamp.ts'])
    mkdirSync(join(rootDir, 'server/middleware'), { recursive: true })
    symlinkSync(join(rootDir, 'shared/stamp.ts'), join(rootDir, 'server/middleware/stamp.global.ts'))
    symlinkSync(join(rootDir, 'shared/missing.ts'), join(rootDir, 'server/middleware/broken.global.ts'))

    const found = findRejectedScanSuffixes(createNuxt(rootDir), { scanDirs: [join(rootDir, 'server')] }, (await loadParseScanPath())!)
    expect(found).toEqual([{ path: join(rootDir, 'server/middleware/stamp.global.ts'), suffix: 'global' }])
  })

  it('reads the directory names nitro is configured with', async () => {
    const rootDir = createProject([
      'server/endpoints/users.recent.ts',
      'server/api/ignored.recent.ts',
      'server/pages/feed.custom.ts',
      'server/routes/ignored.custom.ts',
    ])

    const found = findRejectedScanSuffixes(createNuxt(rootDir), { scanDirs: [join(rootDir, 'server')], apiDir: 'endpoints', routesDir: 'pages' }, (await loadParseScanPath())!)
    expect(found).toEqual([
      { path: join(rootDir, 'server/endpoints/users.recent.ts'), suffix: 'recent' },
      { path: join(rootDir, 'server/pages/feed.custom.ts'), suffix: 'custom' },
    ])
  })

  it('does not report a suffix the user already listed', async () => {
    const rootDir = createProject(npmxFiles)

    const found = findRejectedScanSuffixes(createNuxt(rootDir), { scanDirs: [join(rootDir, 'server')], scanSuffixes: ['global'] }, (await loadParseScanPath())!)
    expect(found.map(entry => entry.suffix)).toEqual(['publication'])
  })
})

describe('setupScanSuffixes', () => {
  it('adds the rejected suffixes to `scanSuffixes` with `nitroLegacy.config`, after the user\'s own', async () => {
    const kept = silence('NUXT_B9013')
    const rejected = silence('NUXT_B9014')
    const rootDir = createProject([...npmxFiles, 'server/routes/feed.custom.ts', 'server/middleware/other.global.ts'])
    const nitroConfig: NitroConfig = { rootDir, serverDir: join(rootDir, 'server'), scanDirs: [join(rootDir, 'server')], scanSuffixes: ['custom'] }

    await setupScanSuffixes(createNuxt(rootDir), nitroConfig, resolveNitroLegacyOptions(true).config)

    expect(nitroConfig.scanSuffixes).toEqual(['custom', 'global', 'publication'])
    expect(rejected).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledTimes(1)
    const report = kept.mock.calls[0]![0] as { count: number, files: string, suffixes: string }
    expect(report.count).toBe(3)
    expect(report.files.split('\n  - ').sort()).toEqual([
      '`server/middleware/canonical-redirects.global.ts` (`.global`)',
      '`server/middleware/other.global.ts` (`.global`)',
      '`server/routes/.well-known/site.standard.publication.get.ts` (`.publication`)',
    ])
    expect(report.suffixes.split(', ').sort()).toEqual(['`\'global\'`', '`\'publication\'`'])
  })

  it('leaves `scanSuffixes` alone without `nitroLegacy.config`, and says which files nitro rejects', async () => {
    const kept = silence('NUXT_B9013')
    const rejected = silence('NUXT_B9014')
    const rootDir = createProject(npmxFiles)
    const nitroConfig: NitroConfig = { rootDir, serverDir: join(rootDir, 'server'), scanDirs: [join(rootDir, 'server')] }

    await setupScanSuffixes(createNuxt(rootDir), nitroConfig, resolveNitroLegacyOptions({ config: false }).config)

    expect(nitroConfig.scanSuffixes).toBeUndefined()
    expect(kept).not.toHaveBeenCalled()
    expect(rejected).toHaveBeenCalledTimes(1)
    expect(rejected.mock.calls[0]![0]).toMatchObject({ count: 2 })
  })

  it('reports nothing for names nitro accepts', async () => {
    const kept = silence('NUXT_B9013')
    const rejected = silence('NUXT_B9014')
    const rootDir = createProject(['server/routes/robots.txt.ts', 'server/api/hello.get.ts'])
    const nitroConfig: NitroConfig = { rootDir, serverDir: join(rootDir, 'server'), scanDirs: [join(rootDir, 'server')] }

    for (const keep of [true, false]) {
      await setupScanSuffixes(createNuxt(rootDir), nitroConfig, keep)
    }

    expect(nitroConfig.scanSuffixes).toBeUndefined()
    expect(kept).not.toHaveBeenCalled()
    expect(rejected).not.toHaveBeenCalled()
  })

  it('covers the server directory of every layer', async () => {
    const kept = silence('NUXT_B9013')
    const rootDir = createProject(['server/middleware/stamp.global.ts', 'layer/server/api/feed.atom.get.ts', 'layer/server/api/feed.custom.get.ts'])
    const layerDir = join(rootDir, 'layer')
    const nitroConfig: NitroConfig = { rootDir, serverDir: 'server', scanDirs: [join(rootDir, 'server'), join(layerDir, 'server')] }

    await setupScanSuffixes(createNuxt(rootDir), nitroConfig, true)

    expect(nitroConfig.scanSuffixes).toEqual(['custom', 'global'])
    expect(kept.mock.calls[0]![0]).toMatchObject({ count: 2 })
  })

  describe('in development', () => {
    async function setupDev (keep: boolean, files: string[] = []) {
      const rootDir = createProject(files)
      const nuxt = createNuxt(rootDir, { dev: true })
      const nitroConfig: NitroConfig = { rootDir, serverDir: join(rootDir, 'server'), scanDirs: [join(rootDir, 'server')] }
      const watch = await setupScanSuffixes(nuxt, nitroConfig, keep)
      const nitro = { options: { scanDirs: [`${join(rootDir, 'server')}/`], scanSuffixes: [...nitroConfig.scanSuffixes || []] }, hooks: createHooks() } as any
      const reload = vi.fn()
      nitro.hooks.hook('build:reload', reload)
      watch(nitro)
      const add = async (file: string) => {
        mkdirSync(dirname(join(rootDir, file)), { recursive: true })
        writeFileSync(join(rootDir, file), 'export default () => {}\n')
        await nuxt.callHook('builder:watch', 'add', file)
      }
      return { nitro, reload, add }
    }

    it('keeps the suffix of a file added while the server runs, and has nitro rescan', async () => {
      const kept = silence('NUXT_B9013')
      const { nitro, reload, add } = await setupDev(true)

      await add('server/middleware/stamp.global.ts')
      await add('server/routes/sitemap.xml.ts')
      await add('server/utils/format.date.ts')

      expect(nitro.options.scanSuffixes).toEqual(['global'])
      expect(kept).toHaveBeenCalledTimes(1)
      expect(kept.mock.calls[0]![0]).toMatchObject({ count: 1, files: '`server/middleware/stamp.global.ts` (`.global`)' })
      expect(reload).toHaveBeenCalledTimes(1)

      await add('server/middleware/another.global.ts')
      expect(nitro.options.scanSuffixes).toEqual(['global'])
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('says what to do about a file added while the server runs, without `nitroLegacy.config`', async () => {
      const rejected = silence('NUXT_B9014')
      const { nitro, reload, add } = await setupDev(false, ['server/middleware/stamp.global.ts'])
      rejected.mockClear()

      await add('server/middleware/stamp.global.ts')
      await add('server/routes/.well-known/site.standard.publication.get.ts')
      await add('server/routes/.well-known/site.standard.publication.get.ts')

      expect(nitro.options.scanSuffixes).toEqual([])
      expect(rejected).toHaveBeenCalledTimes(1)
      expect(rejected.mock.calls[0]![0]).toMatchObject({ suffixes: '`\'publication\'`' })
      expect(reload).not.toHaveBeenCalled()
    })
  })
})
