import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'

import { loadNuxtConfig } from '../src/loader/config.ts'

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
