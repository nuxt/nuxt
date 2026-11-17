import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createModuleRuntimeFilter } from '../src/module-imports.ts'

describe('createModuleRuntimeFilter', () => {
  let rootDir: string

  beforeEach(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), 'nitro-module-runtime-')))
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('matches the runtime directories of a module', () => {
    const isModuleRuntime = createModuleRuntimeFilter([join(rootDir, 'modules/local')])
    expect(isModuleRuntime(join(rootDir, 'modules/local/runtime/server/handler.ts'))).toBe(true)
    expect(isModuleRuntime(join(rootDir, 'modules/local/dist/runtime/server/handler.js?query'))).toBe(true)
    expect(isModuleRuntime(join(rootDir, 'modules/local/index.ts'))).toBe(false)
    expect(isModuleRuntime(join(rootDir, 'modules/local-other/runtime/handler.ts'))).toBe(false)
    expect(isModuleRuntime(join(rootDir, 'server/api/handler.ts'))).toBe(false)
  })

  it('matches a module linked into `node_modules` by its real path', async () => {
    const store = join(rootDir, 'node_modules/.pnpm/module@1.0.0/node_modules/module')
    await mkdir(join(store, 'dist/runtime'), { recursive: true })
    await symlink(store, join(rootDir, 'node_modules/module'), 'junction')

    const isModuleRuntime = createModuleRuntimeFilter([join(rootDir, 'node_modules/module')])
    expect(isModuleRuntime(join(store, 'dist/runtime/server/handler.js'))).toBe(true)
    expect(isModuleRuntime(join(rootDir, 'node_modules/module/dist/runtime/server/handler.js'))).toBe(true)
  })

  it('does not match a dependency nested in a module', () => {
    const isModuleRuntime = createModuleRuntimeFilter([join(rootDir, 'node_modules/module')])
    expect(isModuleRuntime(join(rootDir, 'node_modules/module/dist/runtime/node_modules/dep/index.js'))).toBe(false)
  })
})
