import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'
import process from 'node:process'

import { normalize } from 'pathe'
import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

vi.mock('node:fs', () => ({
  existsSync: (id: string) => id.endsWith('app') || id.includes('node_modules'),
}))

describe('nuxt folder structure', () => {
  it('should resolve directories for v3 setup correctly', async () => {
    const result = await applyDefaults(NuxtConfigSchema, {})
    expect(getDirs(result as unknown as NuxtOptions)).toMatchInlineSnapshot(`
      {
        "dir": {
          "app": "<cwd>/app",
          "modules": "<cwd>/modules",
          "public": "<cwd>/public",
        },
        "rootDir": "<cwd>",
        "serverDir": "<cwd>/server",
        "srcDir": "<cwd>/app",
        "workspaceDir": "<cwd>",
      }
    `)
  })

  it('should resolve directories with a custom `srcDir` and `rootDir`', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { srcDir: 'src/', rootDir: '/test' })
    expect(getDirs(result as unknown as NuxtOptions)).toMatchInlineSnapshot(`
      {
        "dir": {
          "app": "/test/src",
          "modules": "/test/modules",
          "public": "/test/public",
        },
        "rootDir": "/test",
        "serverDir": "/test/server",
        "srcDir": "/test/src",
        "workspaceDir": "/test",
      }
    `)
  })

  it('should resolve directories', async () => {
    const result = await applyDefaults(NuxtConfigSchema, {})
    expect(getDirs(result as unknown as NuxtOptions)).toMatchInlineSnapshot(`
      {
        "dir": {
          "app": "<cwd>/app",
          "modules": "<cwd>/modules",
          "public": "<cwd>/public",
        },
        "rootDir": "<cwd>",
        "serverDir": "<cwd>/server",
        "srcDir": "<cwd>/app",
        "workspaceDir": "<cwd>",
      }
    `)
  })

  it('should resolve directories when opting-in to v4 schema with a custom `srcDir` and `rootDir`', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { srcDir: 'customApp/', rootDir: '/test' })
    expect(getDirs(result as unknown as NuxtOptions)).toMatchInlineSnapshot(`
      {
        "dir": {
          "app": "/test/customApp",
          "modules": "/test/modules",
          "public": "/test/public",
        },
        "rootDir": "/test",
        "serverDir": "/test/server",
        "srcDir": "/test/customApp",
        "workspaceDir": "/test",
      }
    `)
  })

  it('should not override value from user for serverDir', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { serverDir: '/myServer' })
    expect(getDirs(result as unknown as NuxtOptions)).toMatchInlineSnapshot(`
      {
        "dir": {
          "app": "<cwd>/app",
          "modules": "<cwd>/modules",
          "public": "<cwd>/public",
        },
        "rootDir": "<cwd>",
        "serverDir": "/myServer",
        "srcDir": "<cwd>/app",
        "workspaceDir": "<cwd>",
      }
    `)
  })

  it('should include ancestor node_modules in modulesDir when rootDir is inside node_modules', async () => {
    const rootDir = '/repo/node_modules/fake-app'
    const result = await applyDefaults(NuxtConfigSchema, { rootDir }) as unknown as NuxtOptions
    expect(result.modulesDir).toBeDefined()
    expect(result.modulesDir).toContain(`${rootDir}/node_modules`)
    expect(result.modulesDir).toContain('/repo/node_modules')
  })

  it('should list modulesDir in order: root node_modules first, then ancestors closest to farthest (two levels)', async () => {
    const rootDir = '/repo/node_modules/level1/node_modules/fake-app'
    const result = await applyDefaults(NuxtConfigSchema, { rootDir }) as unknown as NuxtOptions
    expect(result.modulesDir).toBeDefined()
    expect(result.modulesDir).toContain(`${rootDir}/node_modules`)
    expect(result.modulesDir).toContain('/repo/node_modules/level1/node_modules')
    expect(result.modulesDir).toContain('/repo/node_modules')
    const idx = (arr: string[], el: string) => arr.indexOf(el)
    const mod = result.modulesDir!
    expect(idx(mod, `${rootDir}/node_modules`)).toBeLessThan(idx(mod, '/repo/node_modules/level1/node_modules'))
    expect(idx(mod, '/repo/node_modules/level1/node_modules')).toBeLessThan(idx(mod, '/repo/node_modules'))
  })
})

function getDirs (options: NuxtOptions) {
  const stripRoot = (dir: string) => {
    return normalize(dir).replace(normalize(process.cwd()), '<cwd>')
  }
  return {
    rootDir: stripRoot(options.rootDir),
    serverDir: stripRoot(options.serverDir),
    srcDir: stripRoot(options.srcDir),
    dir: {
      app: stripRoot(options.dir.app),
      modules: stripRoot(options.dir.modules),
      public: stripRoot(options.dir.public),
    },
    workspaceDir: stripRoot(options.workspaceDir!),
  }
}
