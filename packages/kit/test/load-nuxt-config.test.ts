import { mkdir, rm, writeFile } from 'node:fs/promises'
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
