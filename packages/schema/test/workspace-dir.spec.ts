import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

let parentDir: string

async function resolveWorkspaceDir (parentFiles: Record<string, string>, projectFiles: Record<string, string>, config: { workspaceDir?: string } = {}) {
  parentDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-workspace-dir-')))
  const rootDir = join(parentDir, 'project')
  for (const [dir, files] of [[parentDir, parentFiles], [rootDir, projectFiles]] as const) {
    for (const [file, contents] of Object.entries(files)) {
      await mkdir(join(dir, file, '..'), { recursive: true })
      await writeFile(join(dir, file), contents)
    }
  }
  await mkdir(rootDir, { recursive: true })
  const options = await applyDefaults(NuxtConfigSchema, { rootDir, ...config }) as unknown as NuxtOptions
  return options.workspaceDir === rootDir ? 'project' : options.workspaceDir === parentDir ? 'parent' : options.workspaceDir
}

describe('workspaceDir', () => {
  afterEach(async () => {
    await rm(parentDir, { recursive: true, force: true })
  })

  it('does not resolve to a parent directory that only has a lockfile', async () => {
    const parent = { 'package.json': '{"dependencies":{}}', 'package-lock.json': '{}' }
    expect(await resolveWorkspaceDir(parent, { 'package.json': '{}', 'package-lock.json': '{}' })).toBe('project')
    expect(await resolveWorkspaceDir(parent, { 'package.json': '{}' })).toBe('project')
    expect(await resolveWorkspaceDir(parent, {})).toBe('project')
  })

  it('does not resolve to a parent directory with a workspace file that declares no workspace', async () => {
    expect(await resolveWorkspaceDir({ 'pnpm-workspace.yaml': 'onlyBuiltDependencies:\n  - esbuild\n' }, { 'package.json': '{}' })).toBe('project')
    expect(await resolveWorkspaceDir({ 'deno.json': '{"tasks":{}}' }, { 'package.json': '{}' })).toBe('project')
    expect(await resolveWorkspaceDir({ 'pnpm-workspace.yaml': 'onlyBuiltDependencies:\n  - esbuild\n' }, { '.git/config': '', 'package.json': '{}' })).toBe('project')
  })

  it('resolves to a parent directory that declares a workspace', async () => {
    expect(await resolveWorkspaceDir({ 'pnpm-workspace.yaml': 'packages:\n  - project\n' }, { 'package.json': '{}' })).toBe('parent')
    expect(await resolveWorkspaceDir({ 'package.json': '{"workspaces":["project"]}' }, { 'package.json': '{}' })).toBe('parent')
    expect(await resolveWorkspaceDir({ 'deno.json': '{"workspace":["./project"]}' }, { 'package.json': '{}' })).toBe('parent')
    expect(await resolveWorkspaceDir({ 'turbo.json': '{}' }, { 'package.json': '{}' })).toBe('parent')
  })

  it('resolves to the closest git repository', async () => {
    expect(await resolveWorkspaceDir({ '.git/config': '', 'package-lock.json': '{}' }, { 'package.json': '{}' })).toBe('parent')
  })

  it('respects an explicit workspaceDir', async () => {
    expect(await resolveWorkspaceDir({ 'package.json': '{"workspaces":["project"]}' }, { 'package.json': '{}' }, { workspaceDir: '.' })).toBe('project')
  })
})
