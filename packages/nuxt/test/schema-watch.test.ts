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

  it('waits for an in-flight schema write to settle before nuxt closes', async () => {
    await writeSchema(rootDir, 'initial')

    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        dev: true,
        experimental: { watcher: 'chokidar' },
      },
    })

    let writeStarted!: () => void
    const started = new Promise<void>((resolve) => { writeStarted = resolve })
    let releaseWrite!: () => void
    const gate = new Promise<void>((resolve) => { releaseWrite = resolve })
    onTestFinished(async () => {
      releaseWrite()
      await nuxt.close()
    })

    nuxt.hook('schema:beforeWrite', async () => {
      writeStarted()
      await gate
    })

    const types = join(nuxt.options.buildDir, 'schema/nuxt.schema.d.ts')
    let edits = 0
    const writer = setInterval(() => {
      writeSchema(rootDir, `edited${edits++}`).catch(() => {})
    }, 100)
    try {
      await Promise.race([
        started,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out waiting for schema:beforeWrite')), 5000)),
      ])
    } finally {
      clearInterval(writer)
    }

    let closed = false
    const closing = nuxt.close().then(() => { closed = true })

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(closed).toBe(false)

    releaseWrite()
    await closing

    expect(closed).toBe(true)
    expect(await readFile(types, 'utf8')).toMatch(/edited\d+\?: number/)
  })

  it('does not start a schema write when closed during resolution', async () => {
    await writeSchema(rootDir, 'initial')

    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        dev: true,
        experimental: { watcher: 'chokidar' },
      },
    })

    let resolveStarted!: () => void
    const started = new Promise<void>((resolve) => { resolveStarted = resolve })
    let releaseResolve!: () => void
    const gate = new Promise<void>((resolve) => { releaseResolve = resolve })
    onTestFinished(async () => {
      releaseResolve()
      await nuxt.close()
    })

    nuxt.hook('schema:resolved', async () => {
      resolveStarted()
      await gate
    })

    let edits = 0
    const writer = setInterval(() => {
      writeSchema(rootDir, `edited${edits++}`).catch(() => {})
    }, 100)
    try {
      await Promise.race([
        started,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out waiting for schema:resolved')), 5000)),
      ])
    } finally {
      clearInterval(writer)
    }

    let closed = false
    const closing = nuxt.close().then(() => { closed = true })

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(closed).toBe(false)

    releaseResolve()
    await closing

    expect(closed).toBe(true)
    const types = join(nuxt.options.buildDir, 'schema/nuxt.schema.d.ts')
    await expect(readFile(types, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
