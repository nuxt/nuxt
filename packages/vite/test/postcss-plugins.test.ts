import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { bundlerDiagnostics } from '@nuxt/kit/internal'

import { resolveCSSOptions } from '../src/css.ts'

const { ensureDependencyInstalled } = vi.hoisted(() => ({ ensureDependencyInstalled: vi.fn(() => Promise.resolve(false)) }))
vi.mock('@nuxt/kit', async original => ({ ...await original<typeof import('@nuxt/kit')>(), ensureDependencyInstalled }))

let rootDir: string

beforeAll(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'nuxt-postcss-'))
  const tailwind = join(rootDir, 'node_modules/tailwindcss')
  await mkdir(tailwind, { recursive: true })
  await writeFile(join(tailwind, 'package.json'), JSON.stringify({ name: 'tailwindcss', type: 'module', exports: { '.': './index.js' } }))
  await writeFile(join(tailwind, 'index.js'), 'export default {}\n')
})

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

describe('resolveCSSOptions', () => {
  it('reports a subpath missing from an installed package without offering to install it', async () => {
    const missingSubpath = vi.spyOn(bundlerDiagnostics, 'NUXT_B7027').mockImplementation(() => ({}) as any)
    const missingPlugin = vi.spyOn(bundlerDiagnostics, 'NUXT_B7007').mockImplementation(() => ({}) as any)

    const nuxt = { options: { rootDir, modulesDir: [join(rootDir, 'node_modules')], postcss: { plugins: { 'tailwindcss/nesting': {} } } } } as unknown as Nuxt
    const css = await resolveCSSOptions(nuxt)

    expect(css?.postcss).toEqual({ plugins: [] })
    expect(missingSubpath).toHaveBeenCalledWith({ pluginName: 'tailwindcss/nesting', packageName: 'tailwindcss' })
    expect(missingPlugin).not.toHaveBeenCalled()
    expect(ensureDependencyInstalled).not.toHaveBeenCalled()
  })
})
