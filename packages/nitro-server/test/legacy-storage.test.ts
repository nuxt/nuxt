import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { NitroConfig } from 'nitro/types'

import { addLegacyRuntimeMounts, createLegacyBuildStorage, getLegacyStorageMounts } from '../src/storage.ts'
import { nitroBuildDiagnostics } from '../src/diagnostics.ts'

function createProject () {
  const rootDir = mkdtempSync(join(tmpdir(), 'nitro-legacy-storage-'))
  onTestFinished(() => rmSync(rootDir, { recursive: true, force: true }))
  const buildDir = join(rootDir, '.nuxt')
  return { rootDir, buildDir, mounts: getLegacyStorageMounts(rootDir, buildDir) }
}

function createNitro (options: Record<string, unknown> = {}) {
  const nitro = { options: { kv: {}, devStorage: {}, ...options }, hooks: createHooks() } as any
  onTestFinished(() => nitro.hooks.callHook('close'))
  return nitro
}

describe('nitro v2 runtime storage mounts', () => {
  it('mounts `build:`, `cache:` and `data:` in development and the prerenderer only', () => {
    const { rootDir, buildDir, mounts } = createProject()
    const nitroConfig: NitroConfig = { kv: { redis: { driver: 'redis' } } }
    addLegacyRuntimeMounts(nitroConfig, mounts)

    expect(nitroConfig.kv).toEqual({ redis: { driver: 'redis' } })
    for (const env of ['$development', '$prerender'] as const) {
      expect(nitroConfig[env]!.kv).toEqual({
        build: { driver: 'fs', base: buildDir },
        cache: { driver: 'fs', base: join(buildDir, 'cache') },
        data: { driver: 'fs', base: join(rootDir, '.data/kv') },
      })
      expect(nitroConfig[env]!.cache).toEqual({ driver: 'memory' })
    }
  })

  it('keeps the mounts and cache driver a project declares', () => {
    const { mounts } = createProject()
    const nitroConfig: NitroConfig = {
      storage: { data: { driver: 'redis' } },
      devStorage: { '/build/': { driver: 'memory' } },
      $development: { cache: { driver: 'fs' } },
      $prerender: { kv: { cache: { driver: 'memory' } } },
    }
    addLegacyRuntimeMounts(nitroConfig, mounts)

    expect(Object.keys(nitroConfig.$development!.kv!)).toEqual(['cache'])
    expect(nitroConfig.$development!.cache).toEqual({ driver: 'fs' })
    expect(nitroConfig.$prerender!.kv).toEqual({ cache: { driver: 'memory' } })
    expect(nitroConfig.$prerender!.cache).toBeUndefined()
  })

  it('leaves the cache driver to Nitro when the project declares a mount below `cache:`', () => {
    const { mounts } = createProject()
    const nitroConfig: NitroConfig = { kv: { 'cache:nitro': { driver: 'memory' } } }
    addLegacyRuntimeMounts(nitroConfig, mounts)

    expect(nitroConfig.$development!.kv).toHaveProperty('cache')
    expect(nitroConfig.$development!.cache).toBeUndefined()
    expect(nitroConfig.$prerender!.cache).toBeUndefined()
  })
})

describe('nitro v2 build-time storage', () => {
  it('reads what the prerenderer wrote below the build directory, and writes there', async () => {
    const { buildDir, mounts } = createProject()
    mkdirSync(join(buildDir, 'repro'), { recursive: true })
    writeFileSync(join(buildDir, 'repro/prerendered.json'), JSON.stringify(['/']))
    const storage = await createLegacyBuildStorage(createNitro(), mounts)

    expect(await storage.getItem('build:repro:prerendered.json')).toEqual(['/'])
    await storage.setItem('cache:repro:value', 'cached')
    expect(readFileSync(join(buildDir, 'cache/repro/value'), 'utf8')).toBe('cached')
    expect(storage.getMount('build:repro').base).toBe('build:')
  })

  it('mounts the storage a project declares over the defaults', async () => {
    const { mounts } = createProject()
    const storage = await createLegacyBuildStorage(createNitro({ kv: { '/data/': { driver: 'memory' } }, devStorage: { 'build:module': { driver: 'memory' } } }), mounts)
    await storage.setItem('data:key', 'value')
    await storage.setItem('build:module:key', 'value')

    expect(storage.getMount('data:key').driver.name).toBe('memory')
    expect(storage.getMount('build:key').driver.name).toBe('fs')
    expect(await storage.getKeys('build')).toEqual(['build:module:key'])
  })

  it('loads a custom driver the project depends on', async () => {
    const { rootDir, mounts } = createProject()
    const driverDir = join(rootDir, 'node_modules/project-driver')
    mkdirSync(driverDir, { recursive: true })
    writeFileSync(join(driverDir, 'package.json'), JSON.stringify({ name: 'project-driver', type: 'module', exports: './index.mjs' }))
    writeFileSync(join(driverDir, 'index.mjs'), `export default () => ({ name: 'project-driver', hasItem: () => true, getItem: key => 'project:' + key, getKeys: () => [] })`)
    const storage = await createLegacyBuildStorage(createNitro({ rootDir, kv: { remote: { driver: 'project-driver' } } }), mounts)

    expect(await storage.getItem('remote:key')).toBe('project:key')
  })

  it('loads the library of a builtin driver from the project', async () => {
    const { rootDir, mounts } = createProject()
    const libDir = join(rootDir, 'node_modules/ioredis')
    mkdirSync(libDir, { recursive: true })
    writeFileSync(join(libDir, 'package.json'), JSON.stringify({ name: 'ioredis', type: 'module', exports: './index.mjs' }))
    writeFileSync(join(libDir, 'index.mjs'), `export class Redis { get (key) { return 'project:' + key } disconnect () {} }`)
    const nitro = createNitro({ rootDir, kv: { redis: { driver: 'redis' } } })
    const storage = await createLegacyBuildStorage(nitro, mounts)

    expect(await storage.getItem('redis:key')).toBe('project:key')
    await nitro.hooks.callHook('close')
  })

  it('disposes the storage when Nitro closes', async () => {
    const { mounts } = createProject()
    const nitro = createNitro()
    const storage = await createLegacyBuildStorage(nitro, mounts)
    const dispose = vi.spyOn(storage, 'dispose')
    await nitro.hooks.callHook('close')

    expect(dispose).toHaveBeenCalledOnce()
  })

  it('reports a mount whose driver cannot be loaded when it is used', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9016').mockImplementation(() => new Error('NUXT_B9016') as any)
    onTestFinished(() => { report.mockRestore() })
    const { mounts } = createProject()
    const storage = await createLegacyBuildStorage(createNitro({ kv: { remote: { driver: 'not-a-storage-driver' } } }), mounts)

    expect(report).not.toHaveBeenCalled()
    await expect(storage.getItem('remote:key')).rejects.toThrow('NUXT_B9016')
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ base: 'remote', driver: 'not-a-storage-driver' }), { method: 'error' })
    expect(await storage.getItem('build:key')).toBeNull()
  })
})
