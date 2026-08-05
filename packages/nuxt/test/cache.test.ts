import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { build, loadNuxt } from 'nuxt'
import type { Nuxt, NuxtBuildOutputs } from '@nuxt/schema'

async function resolveBuildOutputs (nuxt: Nuxt) {
  const resolved: Partial<Record<keyof NuxtBuildOutputs, string>> = {}
  for (const key of Object.keys(nuxt.buildOutputs) as Array<keyof NuxtBuildOutputs>) {
    resolved[key] = String(await nuxt.buildOutputs[key]())
  }
  return resolved
}

describe('buildCache', { sequential: true, timeout: 120_000 }, async () => {
  const workspaceDir = await findWorkspaceDir()
  const tmpDir = join(workspaceDir, '.test/build-cache')

  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(join(tmpDir, 'node_modules'), { recursive: true })
    await mkdir(join(tmpDir, 'project/node_modules'), { recursive: true })
    // Create a minimal app.vue so the build has something to compile
    await writeFile(join(tmpDir, 'project/app.vue'), '<template><div>hello</div></template>')
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('should preserve buildId across cached builds', async () => {
    const rootDir = join(tmpDir, 'project')

    // First build (cache miss) with an explicit buildId
    const nuxt1 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'preserved-id',
        experimental: { buildCache: true },
        dev: false,
        // Isolate the cache directory to avoid interference from other builds
        workspaceDir: tmpDir,
      },
    })
    expect(nuxt1.options.buildId).toBe('preserved-id')
    await build(nuxt1)

    // Read the buildId from the output manifest
    const manifestDir = join(nuxt1.options.buildDir, 'manifest')
    const latestJson = JSON.parse(await readFile(join(manifestDir, 'latest.json'), 'utf-8'))
    expect(latestJson.id).toBe('preserved-id')

    // Second build (cache hit) — provide a DIFFERENT buildId to prove the
    // cached one gets restored over this new one.
    const nuxt2 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'new-id-should-be-overridden',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
      },
    })

    // The buildId should have been restored to the cached value before modules
    // were initialised, overriding the 'new-id-should-be-overridden' value.
    expect(nuxt2.options.buildId).toBe('preserved-id')
    expect(nuxt2.options.runtimeConfig.app.buildId).toBe('preserved-id')

    await build(nuxt2)

    // Verify the manifest was written with the preserved buildId
    const latestJson2 = JSON.parse(await readFile(join(nuxt2.options.buildDir, 'manifest', 'latest.json'), 'utf-8'))
    expect(latestJson2.id).toBe('preserved-id')

    // Verify the per-build manifest exists
    const metaFile = join(nuxt2.options.buildDir, 'manifest', 'meta', 'preserved-id.json')
    expect(existsSync(metaFile)).toBe(true)
  })

  it('should fire build:done on cache hit', async () => {
    const rootDir = join(tmpDir, 'project')

    // First build (cache miss)
    const nuxt1 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'done-test',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
      },
    })
    await build(nuxt1)

    // Second build (cache hit) — build:done should fire
    let buildDoneFired = false
    const nuxt2 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'done-test-new',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
        hooks: {
          'build:done': () => { buildDoneFired = true },
        },
      },
    })
    await build(nuxt2)

    expect(buildDoneFired).toBe(true)
  })

  it('should restore build outputs on cache hit', async () => {
    const rootDir = join(tmpDir, 'project')
    await writeFile(join(rootDir, 'app.vue'), '<template><div class="box">hello</div></template><style scoped>.box { color: red }</style>')

    const nuxt1 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'outputs-1',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
      },
    })
    await build(nuxt1)
    const expected = await resolveBuildOutputs(nuxt1)

    const nuxt2 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'outputs-2',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
      },
    })
    await build(nuxt2)

    expect(await resolveBuildOutputs(nuxt2)).toStrictEqual(expected)
    expect(expected.clientManifest).not.toBe('export default {}')
    expect(expected.ssrStyles).not.toBe('export default {}')
  })

  it('should generate a new buildId when sources change', async () => {
    const rootDir = join(tmpDir, 'project')

    // First build with explicit buildId
    const nuxt1 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'build-1',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
      },
    })
    await build(nuxt1)

    // Change app.vue to invalidate the cache
    await writeFile(join(rootDir, 'app.vue'), '<template><div>updated</div></template>')

    // Second build with a different explicit buildId (cache miss due to source change)
    const nuxt2 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'build-2',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
      },
    })

    // buildId should NOT be restored to 'build-1' because the sources changed
    // (different hash means the .buildid file from the first build doesn't match)
    expect(nuxt2.options.buildId).toBe('build-2')
    await build(nuxt2)

    // Verify manifest uses the new buildId
    const latestJson = JSON.parse(await readFile(join(nuxt2.options.buildDir, 'manifest', 'latest.json'), 'utf-8'))
    expect(latestJson.id).toBe('build-2')
  })
})
