import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { loadNuxt } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPlugin } from '@rsbuild/core'

import { resolveRsbuildConfig } from '../src/config.ts'
import { resolveTypeCheckPlugin } from '../src/plugins/optional.ts'

const fixtureDir = join(import.meta.dirname, '../../../test/fixtures/minimal')
const roots: string[] = []
let missingPackages: string[] = []

vi.mock('@nuxt/kit', async importOriginal => ({
  ...await importOriginal<typeof import('@nuxt/kit')>(),
  ensureDependencyInstalled: (names: string | string[]) => {
    const missing = (Array.isArray(names) ? names : [names]).filter(name => missingPackages.includes(name))
    return Promise.resolve(missing.length ? missing : true)
  },
  getAddDependencyCommand: (names: string[]) => Promise.resolve(`pnpm add -D ${names.join(' ')}`),
}))

beforeEach(() => {
  missingPackages = []
})

function project (files: string[]) {
  const rootDir = mkdtempSync(join(tmpdir(), 'nuxt-rsbuild-typecheck-'))
  roots.push(rootDir)
  for (const file of files) {
    const path = join(rootDir, file)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '{}')
  }
  return rootDir
}

function createNuxt (rootDir: string, dev = true): Nuxt {
  return {
    options: {
      test: false,
      dev,
      rootDir,
      buildDir: join(rootDir, '.nuxt'),
      typesDir: join(rootDir, '.nuxt'),
      modulesDir: [join(rootDir, 'node_modules')],
      typescript: { typeCheck: true },
    },
  } as unknown as Nuxt
}

describe('resolveTypeCheckPlugin', () => {
  afterAll(() => {
    for (const root of roots) {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it('type checks with the project tsconfig', async () => {
    const rootDir = project(['tsconfig.json'])

    expect(await resolveTypeCheckPlugin(createNuxt(rootDir))).toMatchObject({ tsconfigPath: join(rootDir, 'tsconfig.json') })
  })

  it('type checks with the generated app tsconfig', async () => {
    const rootDir = project(['.nuxt/tsconfig.app.json'])

    expect(await resolveTypeCheckPlugin(createNuxt(rootDir))).toMatchObject({ tsconfigPath: join(rootDir, '.nuxt/tsconfig.app.json') })
  })

  it('skips type checking when no tsconfig can be found', async () => {
    const rootDir = project([])
    const warn = vi.spyOn(bundlerDiagnostics, 'NUXT_B7041').mockReturnValue(undefined as never)

    expect(await resolveTypeCheckPlugin(createNuxt(rootDir))).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ rootDir, skipped: true }))
    warn.mockRestore()
  })

  it('fails a production build when no tsconfig can be found', async () => {
    await expect(resolveTypeCheckPlugin(createNuxt(project([]), false))).rejects.toMatchObject({ code: 'NUXT_B7041' })
  })

  it('skips type checking when typescript is missing', async () => {
    missingPackages = ['typescript']
    const rootDir = project(['tsconfig.json'])
    const warn = vi.spyOn(bundlerDiagnostics, 'NUXT_B7040').mockReturnValue(undefined as never)

    expect(await resolveTypeCheckPlugin(createNuxt(rootDir))).toBeUndefined()
    expect(warn).toHaveBeenCalledWith({ deps: '`typescript`', installCommand: 'pnpm add -D typescript', skipped: true })
    warn.mockRestore()
  })

  it('fails a production build when typescript is missing', async () => {
    missingPackages = ['typescript']

    await expect(resolveTypeCheckPlugin(createNuxt(project(['tsconfig.json']), false))).rejects.toMatchObject({ code: 'NUXT_B7040' })
  })
})

describe('rsbuild type check environment', () => {
  it('hands the project tsconfig to the type checker of each environment', async () => {
    const nuxt = await loadNuxt({ cwd: fixtureDir, dev: false, ready: false, overrides: { builder: 'rsbuild', typescript: { typeCheck: true } } })

    try {
      const config = await resolveRsbuildConfig(nuxt)
      const tsconfigPaths: Record<string, string | undefined> = {}
      const captureTsConfig: RsbuildPlugin = {
        name: 'test:capture-tsconfig',
        setup (api) {
          api.modifyBundlerChain((_chain, { environment }) => {
            tsconfigPaths[environment.name] = environment.tsconfigPath
          })
        },
      }
      config.plugins = [...config.plugins ?? [], captureTsConfig]

      await (await createRsbuild({ cwd: fixtureDir, config })).initConfigs()

      expect(tsconfigPaths).toEqual({ client: join(fixtureDir, 'tsconfig.json'), ssr: join(fixtureDir, 'tsconfig.json') })
    } finally {
      await nuxt.close()
    }
  }, 60_000)
})
