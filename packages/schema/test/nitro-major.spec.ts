import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'
import type { InputObject } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

const dirs: string[] = []

async function project (pkg?: Record<string, unknown>) {
  const dir = await mkdtemp(join(tmpdir(), 'nuxt-nitro-major-'))
  dirs.push(dir)
  if (pkg) {
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg))
  }
  return dir
}

async function resolve (config: InputObject) {
  return await applyDefaults(NuxtConfigSchema, config) as unknown as NuxtOptions & { nitroLegacy: unknown }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('_nitroMajor', () => {
  it('builds with nitropack when the project depends on it', async () => {
    const rootDir = await project({ dependencies: { nitropack: '^2.13.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir }))._nitroMajor).toBe(2)
  })

  it('builds with nitro v3 when the project depends on `nitro`', async () => {
    const rootDir = await project({ devDependencies: { nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir }))._nitroMajor).toBe(3)
  })

  it('prefers `nitro` when the project depends on both', async () => {
    const rootDir = await project({ dependencies: { nitropack: '^2.13.0', nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir }))._nitroMajor).toBe(3)
  })

  it('reads the workspace root when the project declares neither', async () => {
    const workspaceDir = await project({ devDependencies: { nitro: '^3.0.0' } })
    const rootDir = await project({ dependencies: {} })
    expect((await resolve({ rootDir, workspaceDir }))._nitroMajor).toBe(3)
  })

  it('ignores a workspace root that declares both', async () => {
    const workspaceDir = await project({ devDependencies: { nitro: '^3.0.0', nitropack: '^2.13.0' } })
    const rootDir = await project({ dependencies: {} })
    expect((await resolve({ rootDir, workspaceDir }))._nitroMajor).toBe(2)
  })

  it('falls back to nitropack when nothing declares either', async () => {
    const rootDir = await project()
    expect((await resolve({ rootDir, workspaceDir: rootDir }))._nitroMajor).toBe(2)
  })

  it('keeps an explicit value', async () => {
    const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir, _nitroMajor: 2 }))._nitroMajor).toBe(2)
  })
})

describe('experimental.nitroViteEnvironment', () => {
  it('is off, and reports `NUXT_B5039` when enabled explicitly', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
      expect((await resolve({ rootDir, workspaceDir: rootDir })).experimental.nitroViteEnvironment).toBe(false)
      expect(warn).not.toHaveBeenCalled()
      expect((await resolve({ rootDir, workspaceDir: rootDir, experimental: { nitroViteEnvironment: true } })).experimental.nitroViteEnvironment).toBe(false)
      expect(warn.mock.calls.map(call => String(call[0])).join('\n')).toContain('NUXT_B5039')
    } finally {
      warn.mockRestore()
    }
  })
})

describe('nitroLegacy', () => {
  it('is on by default for nitro v3', async () => {
    const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir })).nitroLegacy).toBe(true)
  })

  it('is off by default for nitro v3 with `compatibilityVersion: 5`', async () => {
    const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir, future: { compatibilityVersion: 5 } })).nitroLegacy).toBe(false)
  })

  it('leaves the imports off by default for nitro v3 with `experimental.nitroAutoImports: false`', async () => {
    const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir, experimental: { nitroAutoImports: false } })).nitroLegacy).toEqual({ imports: false })
  })

  it('is on by default for nitro v3 with `experimental.nitroAutoImports: true`', async () => {
    const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir, experimental: { nitroAutoImports: true } })).nitroLegacy).toBe(true)
  })

  it('is off by default for nitro v3 with `compatibilityVersion: 5` and `experimental.nitroAutoImports: true`', async () => {
    const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir, future: { compatibilityVersion: 5 }, experimental: { nitroAutoImports: true } })).nitroLegacy).toBe(false)
  })

  it('is off for nitropack', async () => {
    const rootDir = await project({ dependencies: { nitropack: '^2.13.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir })).nitroLegacy).toBe(false)
    expect((await resolve({ rootDir, workspaceDir: rootDir, experimental: { nitroAutoImports: false } })).nitroLegacy).toBe(false)
  })

  it('keeps an explicit value', async () => {
    const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
    expect((await resolve({ rootDir, workspaceDir: rootDir, nitroLegacy: false })).nitroLegacy).toBe(false)
    expect((await resolve({ rootDir, workspaceDir: rootDir, nitroLegacy: { h3: false } })).nitroLegacy).toEqual({ h3: false })
  })

  it('keeps an explicit value with `experimental.nitroAutoImports: false`', async () => {
    const rootDir = await project({ dependencies: { nitro: '^3.0.0' } })
    const experimental = { nitroAutoImports: false }
    expect((await resolve({ rootDir, workspaceDir: rootDir, experimental, nitroLegacy: true })).nitroLegacy).toBe(true)
    expect((await resolve({ rootDir, workspaceDir: rootDir, experimental, nitroLegacy: false })).nitroLegacy).toBe(false)
    expect((await resolve({ rootDir, workspaceDir: rootDir, experimental, nitroLegacy: { h3: false } })).nitroLegacy).toEqual({ h3: false })
    expect((await resolve({ rootDir, workspaceDir: rootDir, experimental, nitroLegacy: { imports: true } })).nitroLegacy).toEqual({ imports: true })
  })
})
