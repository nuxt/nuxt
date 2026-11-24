import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'vite'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'

import { VitePluginCheckerPlugin } from '../src/plugins/vite-plugin-checker.ts'

const workers = new Set<object>()
let checkerOptions: unknown
let missingPackages: string[] = []

vi.mock('@nuxt/kit', async importOriginal => ({
  ...await importOriginal<typeof import('@nuxt/kit')>(),
  ensureDependencyInstalled: (names: string | string[]) => {
    const missing = (Array.isArray(names) ? names : [names]).filter(name => missingPackages.includes(name))
    return Promise.resolve(missing.length ? missing : true)
  },
  getAddDependencyCommand: (names: string[]) => Promise.resolve(`pnpm add -D ${names.join(' ')}`),
}))

vi.mock('vite-plugin-checker', () => ({
  default: (options: unknown): Plugin => {
    checkerOptions = options
    const worker = {}
    return {
      name: 'vite-plugin-checker',
      config () {
        workers.add(worker)
      },
      buildEnd () {
        workers.delete(worker)
      },
    }
  },
}))

function mockNuxt (options: Partial<Record<keyof Nuxt['options'], unknown>>): Nuxt {
  return {
    options: {
      test: false,
      dev: true,
      ssr: true,
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
      typescript: { typeCheck: true },
      ...options,
    },
  } as unknown as Nuxt
}

describe('vite-plugin-checker', () => {
  beforeEach(() => {
    checkerOptions = undefined
    missingPackages = []
  })

  it.each([
    [true, true, false, true],
    [true, false, false, true],
    ['build', true, false, false],
    ['build', false, false, true],
    ['dev', true, false, true],
    ['dev', false, false, false],
    [false, true, false, false],
    [false, false, false, false],
    [true, true, true, false],
    ['build', false, true, false],
    ['dev', true, true, false],
  ] as const)('typeCheck: %s, dev: %s, test: %s -> enabled: %s', async (typeCheck, dev, test, enabled) => {
    const nuxt = mockNuxt({ test, dev, typescript: { typeCheck } })

    expect(!!(await VitePluginCheckerPlugin(nuxt))).toBe(enabled)
  })

  it('should terminate every checker worker when the dev server closes', async () => {
    const nuxt = mockNuxt({})

    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      environments: {
        client: {},
        ssr: {},
      },
      plugins: [VitePluginCheckerPlugin(nuxt)],
    })

    expect(workers.size).toBeGreaterThan(0)
    await server.close()
    expect(workers.size).toBe(0)
  })

  it('should use the generated app tsconfig when the project has none', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-typecheck-'))
    const buildDir = join(rootDir, '.nuxt')
    await mkdir(buildDir, { recursive: true })
    await writeFile(join(buildDir, 'tsconfig.app.json'), '{}')

    expect(await VitePluginCheckerPlugin(mockNuxt({ rootDir, buildDir }))).toBeDefined()
    expect(checkerOptions).toStrictEqual({ vueTsc: { tsconfigPath: join(buildDir, 'tsconfig.app.json'), buildMode: false } })
  })

  it('should skip type checking when no tsconfig can be found', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-typecheck-'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await VitePluginCheckerPlugin(mockNuxt({ rootDir, buildDir: join(rootDir, '.nuxt') }))).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NUXT_B7041'))
    warn.mockRestore()
  })

  it('should skip type checking when the type checking packages are missing', async () => {
    missingPackages = ['vue-tsc']
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await VitePluginCheckerPlugin(mockNuxt({}))).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NUXT_B7040'))
    warn.mockRestore()
  })

  it('should fail a production build when the type checking packages are missing', async () => {
    missingPackages = ['vue-tsc']

    await expect(VitePluginCheckerPlugin(mockNuxt({ dev: false }))).rejects.toMatchObject({ code: 'NUXT_B7040' })
  })

  it('should fail a production build when no tsconfig can be found', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-typecheck-'))

    await expect(VitePluginCheckerPlugin(mockNuxt({ dev: false, rootDir, buildDir: join(rootDir, '.nuxt') }))).rejects.toMatchObject({ code: 'NUXT_B7041' })
  })
})
