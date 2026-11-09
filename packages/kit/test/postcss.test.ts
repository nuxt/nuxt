import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import { bundlerDiagnostics } from '../src/diagnostics/bundler.ts'
import { resolvePostcssPlugins } from '../src/internal/postcss.ts'

const { ensureDependencyInstalled } = vi.hoisted(() => ({ ensureDependencyInstalled: vi.fn(() => Promise.resolve(false)) }))
vi.mock('../src/dependency.ts', async original => ({ ...await original<typeof import('../src/dependency.ts')>(), ensureDependencyInstalled }))

let rootDir: string

beforeAll(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'nuxt-postcss-'))
  const tailwind = join(rootDir, 'node_modules/tailwindcss')
  await mkdir(tailwind, { recursive: true })
  await writeFile(join(tailwind, 'package.json'), JSON.stringify({ name: 'tailwindcss', type: 'module', exports: { '.': './index.js', './broken': './broken.js' } }))
  await writeFile(join(tailwind, 'index.js'), 'export default {}\n')
  await writeFile(join(tailwind, 'broken.js'), 'import "missing-dependency"\nexport default () => ({})\n')
})

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  ensureDependencyInstalled.mockClear()
})

describe('resolvePostcssPlugins', () => {
  it('reports a subpath missing from an installed package without offering to install it', async () => {
    const missingSubpath = vi.spyOn(bundlerDiagnostics, 'NUXT_B7027').mockImplementation(() => ({}) as any)
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    const nuxt = { options: { rootDir, modulesDir: [join(rootDir, 'node_modules')], postcss: { plugins: { 'tailwindcss/nesting': {} } } } } as unknown as Nuxt
    expect(await resolvePostcssPlugins(nuxt)).toEqual([])
    expect(missingSubpath).toHaveBeenCalledWith({ pluginName: 'tailwindcss/nesting', packageName: 'tailwindcss' })
    expect(missingPlugin).not.toHaveBeenCalled()
    expect(ensureDependencyInstalled).not.toHaveBeenCalled()
  })

  it('does not report a subpath that resolves but fails to load as missing', async () => {
    const missingSubpath = vi.spyOn(bundlerDiagnostics, 'NUXT_B7027').mockImplementation(() => ({}) as any)
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    const nuxt = { options: { rootDir, modulesDir: [join(rootDir, 'node_modules')], postcss: { plugins: { 'tailwindcss/broken': {} } } } } as unknown as Nuxt
    await resolvePostcssPlugins(nuxt)

    expect(missingSubpath).not.toHaveBeenCalled()
    expect(missingPlugin).toHaveBeenCalledWith(expect.objectContaining({ pluginName: 'tailwindcss/broken' }))
  })
})
