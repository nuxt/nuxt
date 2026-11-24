import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { bundlerDiagnostics } from '@nuxt/kit/internal'

import '../src/impl.ts'
import { clientPlugins } from '../src/configs/client.ts'
import { serverPlugins } from '../src/configs/server.ts'
import { resolveTypeCheckTsConfig } from '../src/utils/options.ts'
import type { WebpackConfigContext } from '../src/utils/config.ts'

const roots: string[] = []
let checkerOptions: unknown[] = []
let missingPackages: string[] = []

vi.mock('@nuxt/kit', async importOriginal => ({
  ...await importOriginal<typeof import('@nuxt/kit')>(),
  ensureDependencyInstalled: (names: string | string[]) => {
    const missing = (Array.isArray(names) ? names : [names]).filter(name => missingPackages.includes(name))
    return Promise.resolve(missing.length ? missing : true)
  },
  getAddDependencyCommand: (names: string[]) => Promise.resolve(`pnpm add -D ${names.join(' ')}`),
}))

vi.mock('fork-ts-checker-webpack-plugin', () => ({
  default: class {
    constructor (options: unknown) {
      checkerOptions.push(options)
    }

    apply () {}
  },
}))

function project (files: string[]) {
  const rootDir = mkdtempSync(join(tmpdir(), 'nuxt-webpack-typecheck-'))
  roots.push(rootDir)
  for (const file of files) {
    const path = join(rootDir, file)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '{}')
  }
  return rootDir
}

function createContext (rootDir: string, options: { dev?: boolean, ssr?: boolean } = {}) {
  const dev = options.dev ?? true
  const nuxt = {
    options: {
      test: false,
      dev,
      ssr: options.ssr ?? true,
      rootDir,
      buildDir: join(rootDir, '.nuxt'),
      typesDir: join(rootDir, '.nuxt'),
      modulesDir: [join(rootDir, 'node_modules')],
      typescript: { typeCheck: true },
    },
  }
  return {
    nuxt,
    options: nuxt.options,
    isDev: dev,
    isClient: true,
    isServer: false,
    name: 'client',
    userConfig: {},
    config: { plugins: [] as unknown[] },
  } as unknown as WebpackConfigContext
}

describe('resolveTypeCheckTsConfig', () => {
  beforeEach(() => {
    missingPackages = []
    checkerOptions = []
  })

  afterAll(() => {
    for (const root of roots) {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it('uses the project tsconfig', async () => {
    const rootDir = project(['tsconfig.json'])
    expect(await resolveTypeCheckTsConfig(createContext(rootDir).nuxt)).toBe(join(rootDir, 'tsconfig.json'))
  })

  it('falls back to the generated app tsconfig', async () => {
    const rootDir = project(['.nuxt/tsconfig.app.json'])
    expect(await resolveTypeCheckTsConfig(createContext(rootDir).nuxt)).toBe(join(rootDir, '.nuxt/tsconfig.app.json'))
  })

  it('ignores the tsconfig of a package the project is nested in', async () => {
    const dir = project(['node_modules/dep/tsconfig.json', 'node_modules/dep/.nuxt/tsconfig.app.json'])
    const rootDir = join(dir, 'node_modules/dep')

    expect(await resolveTypeCheckTsConfig(createContext(rootDir).nuxt)).toBe(join(rootDir, '.nuxt/tsconfig.app.json'))
  })

  it('skips type checking when the tsconfig of the project and the generated one are missing', async () => {
    const rootDir = project([])
    const warn = vi.spyOn(bundlerDiagnostics, 'NUXT_B7041').mockReturnValue(undefined as never)

    expect(await resolveTypeCheckTsConfig(createContext(rootDir).nuxt)).toBeUndefined()
    expect(warn).toHaveBeenCalledWith({ rootDir, tsconfigPath: join(rootDir, '.nuxt/tsconfig.app.json'), skipped: true })
    warn.mockRestore()
  })

  it('fails a production build when no tsconfig can be found', async () => {
    const rootDir = project([])

    await expect(resolveTypeCheckTsConfig(createContext(rootDir, { dev: false }).nuxt)).rejects.toMatchObject({ code: 'NUXT_B7041' })
  })

  it('skips type checking when typescript is missing', async () => {
    missingPackages = ['typescript']
    const rootDir = project(['tsconfig.json'])
    const warn = vi.spyOn(bundlerDiagnostics, 'NUXT_B7040').mockReturnValue(undefined as never)

    expect(await resolveTypeCheckTsConfig(createContext(rootDir).nuxt)).toBeUndefined()
    expect(warn).toHaveBeenCalledWith({ deps: '`typescript`', installCommand: 'pnpm add -D typescript', skipped: true })
    warn.mockRestore()
  })

  it('fails a production build when typescript is missing', async () => {
    missingPackages = ['typescript']

    await expect(resolveTypeCheckTsConfig(createContext(project(['tsconfig.json']), { dev: false }).nuxt)).rejects.toMatchObject({ code: 'NUXT_B7040' })
  })
})

describe('webpack type check plugin', () => {
  beforeEach(() => {
    missingPackages = []
    checkerOptions = []
  })

  it('type checks the server build with the project tsconfig', async () => {
    const rootDir = project(['tsconfig.json'])
    const ctx = createContext(rootDir)

    await serverPlugins(ctx)

    expect(ctx.config.plugins).toHaveLength(1)
    expect(checkerOptions).toMatchObject([{ typescript: { configFile: join(rootDir, 'tsconfig.json') } }])
  })

  it('type checks the client build when SSR is disabled', async () => {
    const rootDir = project(['tsconfig.json'])
    const ctx = createContext(rootDir, { ssr: false })

    await clientPlugins(ctx)

    expect(ctx.config.plugins).toHaveLength(1)
    expect(checkerOptions).toMatchObject([{ typescript: { configFile: join(rootDir, 'tsconfig.json') } }])
  })

  it('does not type check the client build when SSR is enabled', async () => {
    const ctx = createContext(project(['tsconfig.json']), { ssr: true })

    await clientPlugins(ctx)

    expect(ctx.config.plugins).toHaveLength(0)
    expect(checkerOptions).toEqual([])
  })

  it('keeps the build running without a type checker when the tsconfig is missing', async () => {
    const warn = vi.spyOn(bundlerDiagnostics, 'NUXT_B7041').mockReturnValue(undefined as never)
    const ctx = createContext(project([]))

    await serverPlugins(ctx)

    expect(ctx.config.plugins).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
