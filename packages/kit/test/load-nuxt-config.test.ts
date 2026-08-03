import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'

import type { NuxtConfig } from '@nuxt/schema'

import type { ResolvedNuxtConfigContext } from '../src/loader/config.ts'
import { diffNuxtConfig, loadNuxtConfig } from '../src/loader/config.ts'

const repoRoot = await findWorkspaceDir()

describe('loadNuxtConfig layer deduplication', () => {
  const tempDir = join(repoRoot, 'temp', 'layer-dedup')

  beforeAll(async () => {
    await mkdir(join(tempDir, 'layers', 'base'), { recursive: true })
    await writeFile(
      join(tempDir, 'layers', 'base', 'nuxt.config.ts'),
      'export default defineNuxtConfig({ css: [\'dedup-marker.css\'] })',
    )
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('does not merge a layer twice when auto-scanned and also in `extends` (#34667)', async () => {
    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      'export default defineNuxtConfig({ extends: [\'./layers/base\'] })',
    )
    const config = await loadNuxtConfig({ cwd: tempDir })
    expect(config.css).toEqual(['dedup-marker.css'])
  })

  it('still auto-scans a `layers/` layer without an explicit `extends`', async () => {
    await writeFile(join(tempDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({})')
    const config = await loadNuxtConfig({ cwd: tempDir })
    expect(config.css).toEqual(['dedup-marker.css'])
  })
})

describe('loadNuxtConfig layer identity canonicalisation', () => {
  const tempDir = join(repoRoot, 'temp', 'layer-identity')

  beforeAll(async () => {
    // remove leftovers from an aborted previous run - `symlink` throws EEXIST
    await rm(tempDir, { recursive: true, force: true })
    await mkdir(join(tempDir, 'layers', 'base'), { recursive: true })
    await mkdir(join(tempDir, 'real-layer'), { recursive: true })
    await writeFile(
      join(tempDir, 'layers', 'base', 'nuxt.config.ts'),
      'export default defineNuxtConfig({ css: [\'base-marker.css\'] })',
    )
    await writeFile(
      join(tempDir, 'real-layer', 'nuxt.config.ts'),
      'export default defineNuxtConfig({ css: [\'real-marker.css\'] })',
    )
    // `junction` so this also works on Windows CI without elevated permissions
    await symlink(join(tempDir, 'real-layer'), join(tempDir, 'layers', 'linked'), 'junction')
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('dedupes a layer extended via a symlink and via its real path', async () => {
    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      'export default defineNuxtConfig({ extends: [\'./layers/linked\', \'./real-layer\'] })',
    )
    const config = await loadNuxtConfig({ cwd: tempDir })
    expect(config.css?.filter(entry => entry === 'real-marker.css')).toHaveLength(1)
  })

  it('dedupes a layer extended via its config file path and auto-scanned as a dir', async () => {
    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      'export default defineNuxtConfig({ extends: [\'./layers/base/nuxt.config.ts\'] })',
    )
    // c12 resolves the config-file fallback path relative to `process.cwd()`,
    // so the file-path spelling only loads (and without the fix, double-merges)
    // when the process cwd is the project root - as in a real `nuxt dev`
    const originalCwd = process.cwd()
    process.chdir(tempDir)
    try {
      const config = await loadNuxtConfig({ cwd: tempDir })
      expect(config.css?.filter(entry => entry === 'base-marker.css')).toHaveLength(1)
    } finally {
      process.chdir(originalCwd)
    }
  })
})

describe('loadNuxtConfig onConfigResolved', () => {
  const tempDir = join(repoRoot, 'temp', 'config-resolved')

  beforeAll(async () => {
    await mkdir(tempDir, { recursive: true })
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should receive the merged config before defaults are applied', async () => {
    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      'export default defineNuxtConfig({ ssr: false, modules: [] })',
    )
    const contexts: ResolvedNuxtConfigContext[] = []
    await loadNuxtConfig({ cwd: tempDir, onConfigResolved: ctx => void contexts.push(ctx) })

    expect(contexts).toHaveLength(1)
    const [context] = contexts
    expect(context!.rawConfig).toMatchObject({ ssr: false, modules: [] })
    expect(context!.cwd).toBe(tempDir)
    expect(context!.configFile).toBe(join(tempDir, 'nuxt.config.ts'))
    expect(context!.layers.length).toBeGreaterThan(0)
  })

  it('should provide snapshots that can be diffed between loads', async () => {
    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      'export default defineNuxtConfig({ ssr: true, telemetry: false })',
    )
    let first: NuxtConfig | undefined
    await loadNuxtConfig({ cwd: tempDir, onConfigResolved: ctx => void (first = ctx.rawConfig) })

    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      'export default defineNuxtConfig({ ssr: false, telemetry: false, modules: [\'a\'] })',
    )
    let second: NuxtConfig | undefined
    await loadNuxtConfig({ cwd: tempDir, onConfigResolved: ctx => void (second = ctx.rawConfig) })

    const entries = diffNuxtConfig(first!, second!)
    expect(entries.map(entry => entry.key).sort()).toEqual(['modules', 'ssr'])
    expect(entries.find(entry => entry.key === 'ssr')).toMatchObject({ type: 'changed', oldValue: true, newValue: false })
  })

  it('should not be required', async () => {
    await writeFile(join(tempDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({ ssr: false })')
    const config = await loadNuxtConfig({ cwd: tempDir })
    expect(config.ssr).toBe(false)
  })

  it('should exclude `overrides` and `defaults` supplied by the caller', async () => {
    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      'export default defineNuxtConfig({ ssr: true })',
    )
    let baseline: NuxtConfig | undefined
    await loadNuxtConfig({ cwd: tempDir, onConfigResolved: ctx => void (baseline = ctx.rawConfig) })

    let withExtras: NuxtConfig | undefined
    await loadNuxtConfig({
      cwd: tempDir,
      overrides: { dev: true },
      defaults: { devServer: { cors: { origin: ['http://localhost:3000'] } } },
      onConfigResolved: ctx => void (withExtras = ctx.rawConfig),
    })

    expect(diffNuxtConfig(baseline!, withExtras!)).toEqual([])
    expect(withExtras).not.toHaveProperty('dev')
    expect(withExtras).not.toHaveProperty('devServer')
  })

  it('should not report changes for functions and other non-plain values in an unchanged config', async () => {
    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      [
        'export default defineNuxtConfig({',
        '  hooks: { \'build:done\': () => \'noop\' },',
        '  modules: [{ setup () {} }],',
        '  ignore: [/^ignored/.source],',
        '  vite: { define: { WHEN: new Date(0).toISOString() } },',
        '})',
      ].join('\n'),
    )
    const snapshots: NuxtConfig[] = []
    const load = () => loadNuxtConfig({ cwd: tempDir, onConfigResolved: ctx => void snapshots.push(ctx.rawConfig) })
    await load()
    await load()

    expect(diffNuxtConfig(snapshots[0]!, snapshots[1]!)).toEqual([])
  })

  it('should fire once with `extends` layers', async () => {
    await mkdir(join(tempDir, 'layers', 'base'), { recursive: true })
    await writeFile(
      join(tempDir, 'layers', 'base', 'nuxt.config.ts'),
      'export default defineNuxtConfig({ css: [\'base.css\'] })',
    )
    await writeFile(
      join(tempDir, 'nuxt.config.ts'),
      'export default defineNuxtConfig({ extends: [\'./layers/base\'], css: [\'app.css\'] })',
    )
    const snapshots: NuxtConfig[] = []
    const config = await loadNuxtConfig({ cwd: tempDir, onConfigResolved: ctx => void snapshots.push(ctx.rawConfig) })

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]!.css).toEqual(config.css)
    await rm(join(tempDir, 'layers'), { recursive: true, force: true })
  })

  it('should not fire when config loading throws', async () => {
    await writeFile(join(tempDir, 'nuxt.config.ts'), 'throw new Error(\'broken config\')')
    let called = false
    await expect(loadNuxtConfig({ cwd: tempDir, onConfigResolved: () => void (called = true) })).rejects.toThrow()
    expect(called).toBe(false)
  })

  it('should be awaited before resolving', async () => {
    await writeFile(join(tempDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({})')
    let done = false
    await loadNuxtConfig({
      cwd: tempDir,
      onConfigResolved: async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
        done = true
      },
    })
    expect(done).toBe(true)
  })
})
