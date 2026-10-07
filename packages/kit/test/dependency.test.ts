import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { x } from 'tinyexec'

import { ensureDependencyInstalled, getAddDependencyCommand } from '../src/dependency.ts'
import { logger } from '../src/logger.ts'

vi.mock('std-env', async original => ({ ...await original<typeof import('std-env')>(), isCI: false, hasTTY: true, provider: '' }))
vi.mock('tinyexec', () => ({ x: vi.fn(() => Promise.resolve({ exitCode: 0, stdout: '', stderr: '' })) }))
vi.mock('package-manager-detector', async original => ({
  ...await original<typeof import('package-manager-detector')>(),
  detect: () => Promise.resolve({ name: 'pnpm', agent: 'pnpm' }),
}))

let rootDir: string

beforeAll(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'nuxt-dependency-'))
  await writeFile(join(rootDir, 'package.json'), JSON.stringify({ name: 'app', private: true }))
  // `tailwindcss` v4 no longer ships the `tailwindcss/nesting` subpath it had in v3
  const tailwind = join(rootDir, 'node_modules/tailwindcss')
  await mkdir(tailwind, { recursive: true })
  await writeFile(join(tailwind, 'package.json'), JSON.stringify({ name: 'tailwindcss', type: 'module', exports: { '.': './index.js' } }))
  await writeFile(join(tailwind, 'index.js'), 'export default {}\n')
})

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(x).mockClear()
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

    expect(prompt).not.toHaveBeenCalled()
    expect(x).not.toHaveBeenCalled()
  })

  it('installs the package a missing subpath belongs to', async () => {
    const prompt = vi.spyOn(logger, 'prompt').mockResolvedValue(true)

    await expect(ensureDependencyInstalled('@scope/missing/plugin', { rootDir, searchPaths: [] })).resolves.toBe(true)

    expect(prompt).toHaveBeenCalledWith('Do you want to install `@scope/missing`?', expect.anything())
    expect(x).toHaveBeenCalledOnce()
    const [command, args] = vi.mocked(x).mock.calls[0]!
    expect(command).toBe('pnpm')
    expect(args).toContain('@scope/missing')
    expect(args).not.toContain('@scope/missing/plugin')
  })
})
