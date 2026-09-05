import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'
import { resolve } from 'pathe'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

const existingPaths = new Set<string>()

vi.mock('node:fs', () => ({
  existsSync: (id: string) => existingPaths.has(id),
}))

async function resolveCacheDir (config: { rootDir: string, workspaceDir?: string, vite?: { cacheDir?: string } }) {
  const result = await applyDefaults(NuxtConfigSchema, config) as unknown as NuxtOptions
  return result.vite.cacheDir
}

describe('vite.cacheDir', () => {
  it('resolves under workspaceDir when rootDir matches workspaceDir', async () => {
    expect(await resolveCacheDir({
      rootDir: '/project',
      workspaceDir: '/project',
    })).toBe(resolve('/project', 'node_modules/.cache/vite'))
  })

  it('resolves under workspaceDir when nested rootDir has no node_modules', async () => {
    expect(await resolveCacheDir({
      rootDir: '/project/src',
      workspaceDir: '/project',
    })).toBe(resolve('/project', 'node_modules/.cache/vite/src'))
  })

  it('keeps per-app caches distinct for multiple apps in a workspace', async () => {
    expect(await resolveCacheDir({
      rootDir: '/project/apps/foo',
      workspaceDir: '/project',
    })).toBe(resolve('/project', 'node_modules/.cache/vite/apps/foo'))
    expect(await resolveCacheDir({
      rootDir: '/project/apps_foo',
      workspaceDir: '/project',
    })).toBe(resolve('/project', 'node_modules/.cache/vite/apps_foo'))
  })

  it('resolves under rootDir when it has its own node_modules', async () => {
    existingPaths.add(resolve('/project/apps/foo', 'node_modules'))
    try {
      expect(await resolveCacheDir({
        rootDir: '/project/apps/foo',
        workspaceDir: '/project',
      })).toBe(resolve('/project/apps/foo', 'node_modules/.cache/vite'))
    } finally {
      existingPaths.clear()
    }
  })

  it('resolves under rootDir when workspaceDir is not an ancestor', async () => {
    expect(await resolveCacheDir({
      rootDir: '/project/src',
      workspaceDir: '/project/src/nested',
    })).toBe(resolve('/project/src', 'node_modules/.cache/vite'))
  })

  it('respects an explicit vite.cacheDir', async () => {
    expect(await resolveCacheDir({
      rootDir: '/project/src',
      workspaceDir: '/project',
      vite: { cacheDir: '/custom/cache' },
    })).toBe('/custom/cache')
  })
})
