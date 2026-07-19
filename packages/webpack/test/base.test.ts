import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { packageDependencyDirs } from '../src/presets/base.ts'

describe('packageDependencyDirs', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(resolve(tmpdir(), 'nuxt-webpack-base-'))

    // isolated pnpm layout: dependencies are symlinked beside the package in its group
    const pnpmGroup = resolve(root, 'isolated/node_modules/.pnpm/pkg@1.0.0/node_modules')
    mkdirSync(resolve(pnpmGroup, 'pkg/dist'), { recursive: true })
    mkdirSync(resolve(pnpmGroup, 'dependency'), { recursive: true })
    writeFileSync(resolve(pnpmGroup, 'pkg/package.json'), '{}')
    writeFileSync(resolve(pnpmGroup, 'pkg/dist/index.mjs'), '')

    // hoisted/workspace layout: dependencies live in the package's own node_modules
    const workspacePkg = resolve(root, 'workspace/packages/pkg')
    mkdirSync(resolve(workspacePkg, 'dist'), { recursive: true })
    mkdirSync(resolve(workspacePkg, 'node_modules/dependency'), { recursive: true })
    writeFileSync(resolve(workspacePkg, 'package.json'), '{}')
    writeFileSync(resolve(workspacePkg, 'dist/index.mjs'), '')
  })

  afterAll(() => {
    rmSync(root, { force: true, recursive: true })
  })

  it('resolves the pnpm group directory holding the package and its dependencies', () => {
    const pnpmGroup = resolve(root, 'isolated/node_modules/.pnpm/pkg@1.0.0/node_modules')
    expect(packageDependencyDirs(resolve(pnpmGroup, 'pkg/dist/index.mjs'))).toEqual([pnpmGroup])
  })

  it('resolves the package\'s own node_modules in a hoisted/workspace layout', () => {
    const workspacePkg = resolve(root, 'workspace/packages/pkg')
    expect(packageDependencyDirs(resolve(workspacePkg, 'dist/index.mjs'))).toEqual([
      resolve(workspacePkg, 'node_modules'),
    ])
  })

  it('returns nothing when the entry cannot be resolved', () => {
    expect(packageDependencyDirs(undefined)).toEqual([])
  })

  it('omits directories that do not exist', () => {
    const workspacePkg = resolve(root, 'workspace/packages/no-deps')
    mkdirSync(resolve(workspacePkg, 'dist'), { recursive: true })
    writeFileSync(resolve(workspacePkg, 'package.json'), '{}')
    writeFileSync(resolve(workspacePkg, 'dist/index.mjs'), '')
    expect(packageDependencyDirs(resolve(workspacePkg, 'dist/index.mjs'))).toEqual([])
  })
})
