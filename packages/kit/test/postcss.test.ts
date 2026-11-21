import { rm } from 'node:fs/promises'
import { join } from 'pathe'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import { bundlerDiagnostics } from '../src/diagnostics/bundler.ts'
import { resolvePostcssPlugins } from '../src/internal/postcss.ts'
import { createTempDir, fakePackage, writeFiles } from './utils.ts'

const { ensureDependencyInstalled } = vi.hoisted(() => ({ ensureDependencyInstalled: vi.fn(() => Promise.resolve(false)) }))
vi.mock('../src/dependency.ts', async original => ({ ...await original<typeof import('../src/dependency.ts')>(), ensureDependencyInstalled }))

let rootDir: string

beforeAll(async () => {
  rootDir = await createTempDir('nuxt-postcss-')
  await writeFiles(rootDir, {
    ...fakePackage('tailwindcss', 'export default {}\n', { exports: { '.': './index.js', './broken': './broken.js' } }),
    'node_modules/tailwindcss/broken.js': 'import "missing-dependency"\nexport default () => ({})\n',
    'node_modules/tailwindcss-v3/package.json': { name: 'tailwindcss-v3', version: '3.4.19', main: 'lib/index.js' },
    'node_modules/tailwindcss-v3/lib/index.js': 'module.exports = () => ({ postcssPlugin: "tailwindcss" })\n',
    'node_modules/tailwindcss-v3/nesting/index.js': 'module.exports = () => ({ postcssPlugin: "tailwindcss/nesting" })\n',
    'node_modules/tailwindcss-v3/variants/package.json': { main: 'plugin.js' },
    'node_modules/tailwindcss-v3/variants/plugin.js': 'module.exports = () => ({ postcssPlugin: "tailwindcss/variants" })\n',
    'node_modules/tailwindcss-v3/broken/index.js': 'require("missing-dependency")\n',
    'postcss/plugin.ts': 'export default (_opts: unknown) => ({ postcssPlugin: "local" })\n',
  })
})

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  ensureDependencyInstalled.mockClear()
})

describe('resolvePostcssPlugins', () => {
  it('loads a directory subpath of a CommonJS package without `exports`', async () => {
    const missingSubpath = vi.spyOn(bundlerDiagnostics, 'NUXT_B7027').mockImplementation(() => ({}) as any)

    const nuxt = { options: { rootDir, modulesDir: [join(rootDir, 'node_modules')], postcss: { plugins: { 'tailwindcss-v3/nesting': {}, 'tailwindcss-v3/variants': {}, 'tailwindcss-v3': {} } } } } as unknown as Nuxt
    expect(await resolvePostcssPlugins(nuxt)).toEqual([{ postcssPlugin: 'tailwindcss/nesting' }, { postcssPlugin: 'tailwindcss/variants' }, { postcssPlugin: 'tailwindcss' }])
    expect(missingSubpath).not.toHaveBeenCalled()
  })

  it.each([true, false])('loads a plugin installed after a failed lookup (installed: %s)', async (installed) => {
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)
    const name = `postcss-late-${installed}`
    ensureDependencyInstalled.mockImplementationOnce(async () => {
      await writeFiles(rootDir, {
        [`node_modules/${name}/package.json`]: { name, main: 'index.js' },
        [`node_modules/${name}/index.js`]: 'module.exports = () => ({ postcssPlugin: "late" })\n',
        [`node_modules/${name}/nesting/index.js`]: 'module.exports = () => ({ postcssPlugin: "late/nesting" })\n',
      })
      return installed
    })

    const nuxt = { options: { rootDir, modulesDir: [join(rootDir, 'node_modules')], postcss: { plugins: { [`${name}/nesting`]: {}, [name]: {} } } } } as unknown as Nuxt
    expect(await resolvePostcssPlugins(nuxt)).toEqual([{ postcssPlugin: 'late/nesting' }, { postcssPlugin: 'late' }])
    expect(missingPlugin).not.toHaveBeenCalled()
  })

  it('reports a subpath missing from an installed package without offering to install it', async () => {
    const missingSubpath = vi.spyOn(bundlerDiagnostics, 'NUXT_B7027').mockImplementation(() => ({}) as any)
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    const nuxt = { options: { rootDir, modulesDir: [join(rootDir, 'node_modules')], postcss: { plugins: { 'tailwindcss/nesting': {} } } } } as unknown as Nuxt
    expect(await resolvePostcssPlugins(nuxt)).toEqual([])
    expect(missingSubpath).toHaveBeenCalledWith({ pluginName: 'tailwindcss/nesting', packageName: 'tailwindcss' })
    expect(missingPlugin).not.toHaveBeenCalled()
    expect(ensureDependencyInstalled).not.toHaveBeenCalled()
  })

  it('loads a plugin named by an alias without offering to install a missing one', async () => {
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    const nuxt = { options: { rootDir, alias: { '~~': rootDir }, modulesDir: [join(rootDir, 'node_modules')], postcss: { plugins: { '~~/postcss/plugin': {}, '~~/postcss/missing': {} } } } } as unknown as Nuxt
    expect(await resolvePostcssPlugins(nuxt)).toEqual([{ postcssPlugin: 'local' }])
    expect(missingPlugin).toHaveBeenCalledWith({ pluginName: '~~/postcss/missing' })
    expect(ensureDependencyInstalled).not.toHaveBeenCalled()
  })

  it('does not report a subpath that resolves but fails to load as missing', async () => {
    const missingSubpath = vi.spyOn(bundlerDiagnostics, 'NUXT_B7027').mockImplementation(() => ({}) as any)
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    const nuxt = { options: { rootDir, modulesDir: [join(rootDir, 'node_modules')], postcss: { plugins: { 'tailwindcss/broken': {}, 'tailwindcss-v3/broken': {} } } } } as unknown as Nuxt
    await resolvePostcssPlugins(nuxt)

    expect(missingSubpath).not.toHaveBeenCalled()
    expect(missingPlugin).toHaveBeenCalledWith(expect.objectContaining({ pluginName: 'tailwindcss/broken' }))
    expect(missingPlugin).toHaveBeenCalledWith(expect.objectContaining({ pluginName: 'tailwindcss-v3/broken' }))
  })
})
