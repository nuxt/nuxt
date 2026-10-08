import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { x } from 'tinyexec'

import { ensureDependencyInstalled, getAddDependencyCommand, isPackageInstalled, toPackageName } from '../src/dependency.ts'
import { logger } from '../src/logger.ts'

vi.mock('std-env', async original => ({ ...await original<typeof import('std-env')>(), isCI: false, hasTTY: true, provider: '' }))
vi.mock('tinyexec', () => ({ x: vi.fn(() => Promise.resolve({ exitCode: 0, stdout: '', stderr: '' })) }))
vi.mock('package-manager-detector', async original => ({
  ...await original<typeof import('package-manager-detector')>(),
  detect: () => Promise.resolve({ name: 'pnpm', agent: 'pnpm' }),
}))

let rootDir: string

async function createPackage (name: string, exports: Record<string, string>) {
  const dir = join(rootDir, 'node_modules', name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name, type: 'module', exports }))
  await writeFile(join(dir, 'index.js'), 'export default {}\n')
}

function installCreatesPackage (name: string, exports: Record<string, string>) {
  vi.mocked(x).mockImplementationOnce((() => createPackage(name, exports).then(() => ({ exitCode: 0, stdout: '', stderr: '' }))) as any)
}

beforeAll(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'nuxt-dependency-'))
  await writeFile(join(rootDir, 'package.json'), JSON.stringify({ name: 'app', private: true }))
  await createPackage('tailwindcss', { '.': './index.js' })
  await createPackage('subpath-only', { './a': './index.js' })
})

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(x).mockClear()
})

describe('toPackageName', () => {
  it.each([
    ['tailwindcss/nesting', 'tailwindcss'],
    ['@scope/pkg/sub/path', '@scope/pkg'],
    ['@scope/pkg', '@scope/pkg'],
    ['pkg', 'pkg'],
    ['~/plugins/postcss', '~/plugins/postcss'],
    ['@/plugins/postcss', '@/plugins/postcss'],
    ['#build/postcss', '#build/postcss'],
    ['./postcss.js', './postcss.js'],
    ['/abs/postcss.js', '/abs/postcss.js'],
    ['C:/abs/postcss.js', 'C:/abs/postcss.js'],
    ['npm:pkg/sub', 'npm:pkg/sub'],
  ])('maps %s to %s', (specifier, expected) => {
    expect(toPackageName(specifier)).toBe(expected)
  })
})

describe('isPackageInstalled', () => {
  it('detects an installed package that exports neither its root nor its package.json', () => {
    expect(isPackageInstalled('subpath-only', [rootDir])).toBe(true)
    expect(isPackageInstalled('subpath-only', [join(rootDir, 'node_modules')])).toBe(true)
    expect(isPackageInstalled('missing', [rootDir])).toBe(false)
  })
})

describe('getAddDependencyCommand', () => {
  it('installs a subpath as the package it belongs to', async () => {
    const command = await getAddDependencyCommand(['tailwindcss/nesting', '@tailwindcss/vite/internal', '@tailwindcss/vite'], rootDir, { dev: true })
    expect(command.split(' ')).toContain('tailwindcss')
    expect(command.split(' ').filter(arg => arg === '@tailwindcss/vite')).toHaveLength(1)
    expect(command).not.toContain('tailwindcss/nesting')
    expect(command).not.toContain('/internal')
  })
})

describe('ensureDependencyInstalled', () => {
  it('does not offer to install a package that is already installed', async () => {
    const prompt = vi.spyOn(logger, 'prompt').mockResolvedValue(true)

    await expect(ensureDependencyInstalled('tailwindcss/nesting', { rootDir, searchPaths: [] })).resolves.toBe(false)
    await expect(ensureDependencyInstalled(['tailwindcss/nesting'], { rootDir, searchPaths: [] })).resolves.toEqual(['tailwindcss/nesting'])
    await expect(ensureDependencyInstalled('subpath-only/b', { rootDir, searchPaths: [] })).resolves.toBe(false)

    expect(prompt).not.toHaveBeenCalled()
    expect(x).not.toHaveBeenCalled()
  })

  it('installs the package a missing subpath belongs to', async () => {
    const prompt = vi.spyOn(logger, 'prompt').mockResolvedValue(true)
    installCreatesPackage('@scope/missing', { './plugin': './index.js' })

    await expect(ensureDependencyInstalled('@scope/missing/plugin', { rootDir, searchPaths: [] })).resolves.toBe(true)

    expect(prompt).toHaveBeenCalledWith('Do you want to install `@scope/missing`?', expect.anything())
    expect(x).toHaveBeenCalledOnce()
    const [command, args] = vi.mocked(x).mock.calls[0]!
    expect(command).toBe('pnpm')
    expect(args).toContain('@scope/missing')
    expect(args).not.toContain('@scope/missing/plugin')
  })

  it('returns the packages still missing after installing the others', async () => {
    vi.spyOn(logger, 'prompt').mockResolvedValue(true)
    installCreatesPackage('other', { '.': './index.js' })

    await expect(ensureDependencyInstalled(['tailwindcss/nesting', 'other'], { rootDir, searchPaths: [] })).resolves.toEqual(['tailwindcss/nesting'])

    const [, args] = vi.mocked(x).mock.calls[0]!
    expect(args).toContain('other')
    expect(args).not.toContain('tailwindcss')
  })

  it('returns false when the installed package does not provide the subpath', async () => {
    vi.spyOn(logger, 'prompt').mockResolvedValue(true)
    installCreatesPackage('@scope/other', { '.': './index.js' })

    await expect(ensureDependencyInstalled('@scope/other/plugin', { rootDir, searchPaths: [] })).resolves.toBe(false)
    expect(x).toHaveBeenCalledOnce()
  })
})
