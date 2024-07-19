import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { normalize } from 'pathe'
import { NuxtConfigSchema } from '../src'
import type { NuxtOptions } from '../src'

vi.mock('node:fs', () => ({
  existsSync: (id: string) => id.endsWith('app'),
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

  it('should resolve directories when opting-in to v4 schema', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 4 } })
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
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 4 }, srcDir: 'customApp/', rootDir: '/test' })
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
