import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { afterAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { loadNuxt } from 'nuxt'

describe('nuxt.schema watching', { concurrent: false }, async () => {
  const tmpDir = join(await findWorkspaceDir(), '.test/schema-watch')
  const rootDir = join(tmpDir, 'project')
  const layerDir = join(rootDir, 'layers/base')

  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(rootDir, { recursive: true })
    await writeFile(join(rootDir, 'nuxt.config.ts'), 'export default {}\n')
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  const writeSchema = (dir: string, key: string) => writeFile(join(dir, 'nuxt.schema.ts'), `export default defineNuxtSchema({ appConfig: { ${key}: 1 } })\n`)

  it.each([
    ['root', 'chokidar', rootDir],
    ['layer', 'chokidar', layerDir],
    ['root', 'parcel', rootDir],
    ['layer', 'parcel', layerDir],
  ] as const)('regenerates the schema when a %s nuxt.schema file changes (%s)', async (_, watcher, dir) => {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'nuxt.config.ts'), 'export default {}\n')
    await writeSchema(dir, 'initial')

    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        dev: true,
        experimental: { watcher },
      },
    })
    onTestFinished(() => nuxt.close())

    const types = join(nuxt.options.buildDir, 'schema/nuxt.schema.d.ts')
    let edits = 0
    await vi.waitFor(async () => {
      await writeSchema(dir, `edited${edits++}`)
      expect(await readFile(types, 'utf8').catch(() => '')).toMatch(/edited\d+\?: number/)
    }, { timeout: 5000, interval: 250 })
  })
})
