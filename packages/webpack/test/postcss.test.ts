import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { dirname, join } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { getPostcssConfig } from '../src/utils/postcss.ts'

describe('getPostcssConfig', () => {
  let rootDir: string

  beforeAll(() => {
    rootDir = realpathSync(mkdtempSync(join(tmpdir(), 'nuxt-webpack-postcss-')))
    const files = {
      'node_modules/tailwindcss/package.json': JSON.stringify({ name: 'tailwindcss', version: '3.4.19', main: 'lib/index.js' }),
      'node_modules/tailwindcss/lib/index.js': 'module.exports = () => ({ postcssPlugin: "tailwindcss" })\n',
      'node_modules/tailwindcss/nesting/index.js': 'module.exports = () => ({ postcssPlugin: "tailwindcss/nesting" })\n',
      'node_modules/tailwindcss/broken/index.js': 'require("missing-dependency")\n',
      'postcss/plugin.mjs': 'export default () => ({ postcssPlugin: "local" })\n',
    }
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(rootDir, path)), { recursive: true })
      writeFileSync(join(rootDir, path), contents)
    }
  })

  afterAll(() => {
    rmSync(rootDir, { force: true, recursive: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function resolvePlugins (plugins: Record<string, unknown>) {
    const nuxt = {
      options: {
        dev: true,
        rootDir,
        alias: { '~~': rootDir },
        modulesDir: [join(rootDir, 'node_modules')],
        webpack: { postcss: {}, cssSourceMap: false },
        postcss: { plugins: { 'autoprefixer': false, 'postcss-import': false, 'postcss-url': false, ...plugins } },
      },
    } as unknown as Nuxt
    const config = await getPostcssConfig(nuxt)
    return config && config.postcssOptions.plugins
  }

  it('loads a directory subpath of a CommonJS package without `exports`', async () => {
    const missingSubpath = vi.spyOn(bundlerDiagnostics, 'NUXT_B7027').mockImplementation(() => ({}) as any)
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    expect(await resolvePlugins({ 'tailwindcss/nesting': {}, 'tailwindcss': {} })).toEqual([{ postcssPlugin: 'tailwindcss/nesting' }, { postcssPlugin: 'tailwindcss' }])
    expect(missingSubpath).not.toHaveBeenCalled()
    expect(missingPlugin).not.toHaveBeenCalled()
  })

  it('loads a plugin named by an alias without suggesting to install a missing one', async () => {
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    expect(await resolvePlugins({ '~~/postcss/plugin': {}, '~~/postcss/missing': {} })).toEqual([{ postcssPlugin: 'local' }])
    expect(missingPlugin).toHaveBeenCalledWith({ pluginName: '~~/postcss/missing' })
  })

  it('resolves a default plugin from the builder rather than the app', async () => {
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)
    const missingDefault = vi.spyOn(bundlerDiagnostics, 'NUXT_B7011').mockImplementation(() => ({}) as any)

    expect(await resolvePlugins({ 'postcss-url': {} })).toEqual([expect.objectContaining({ postcssPlugin: 'postcss-url' })])
    expect(missingPlugin).not.toHaveBeenCalled()
    expect(missingDefault).not.toHaveBeenCalled()
  })

  it('does not report a subpath that resolves but fails to load as missing', async () => {
    const missingSubpath = vi.spyOn(bundlerDiagnostics, 'NUXT_B7027').mockImplementation(() => ({}) as any)
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    expect(await resolvePlugins({ 'tailwindcss/broken': {} })).toEqual([])
    expect(missingSubpath).not.toHaveBeenCalled()
    expect(missingPlugin).toHaveBeenCalledWith(expect.objectContaining({ pluginName: 'tailwindcss/broken' }))
  })
})
