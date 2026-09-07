import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import process from 'node:process'

import { getRandomPort } from 'get-port-please'
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

/** Boot a built server and return the HTML it renders for `/`. */
async function renderIndex (outputDir: string) {
  const port = await getRandomPort('127.0.0.1')
  const server = spawn(process.execPath, [join(outputDir, 'server/index.mjs')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: 'ignore',
  })
  try {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const html = await fetch(`http://127.0.0.1:${port}/`).then(r => r.text()).catch(() => undefined)
      if (html) {
        return html
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`built server at ${outputDir} did not start`)
  } finally {
    server.kill()
  }
}

// the inline style extracted from the fixture's scoped `<style>` block
const INLINE_STYLE_RE = /<style[^>]*>[^<]*color\s*:\s*red/

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
    const restored = await resolveBuildOutputs(nuxt2)

    expect(expected.clientManifest).not.toBe('export default {}')
    expect(expected.ssrStyles).not.toBe('export default {}')

    // the client bundle is never rebuilt on a hit, so everything derived from
    // it has to come back exactly as it was cached
    for (const key of ['clientManifest', 'clientPrecomputed', 'entryChunkName', 'serverEntry'] as const) {
      expect(restored[key], key).toBe(expected[key])
    }

    // the ssr environment still builds on a hit, so it regenerates these with
    // its own chunk names rather than the cached ones
    expect(restored.ssrStyles).not.toBe('export default {}')
    expect(restored.entryIds).not.toBe('export default []')
  })

  it.each([true, false])('should build nitro on cache hit with nitroViteEnvironment: %s', { timeout: 300_000 }, async (nitroViteEnvironment) => {
    const rootDir = join(tmpDir, 'project')
    const outputDir = join(rootDir, '.output')
    await writeFile(join(rootDir, 'app.vue'), '<template><div class="box">hello</div></template><style scoped>.box { color: red }</style>')

    const nuxt1 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: `nitro-${nitroViteEnvironment}-1`,
        experimental: { buildCache: true, nitroViteEnvironment },
        dev: false,
        workspaceDir: tmpDir,
      },
    })
    await build(nuxt1)
    expect(existsSync(join(outputDir, 'server/index.mjs'))).toBe(true)
    const clientAssets = await readdir(join(outputDir, 'public/_nuxt'))
    expect(clientAssets.length).toBeGreaterThan(0)
    const expectedHtml = await renderIndex(outputDir)
    expect(expectedHtml).toMatch(INLINE_STYLE_RE)

    await rm(outputDir, { recursive: true, force: true })

    // the vue hash ignores `serverDir`, so this is a cache hit that must still
    // produce a server build including the new handler
    await mkdir(join(rootDir, 'server/api'), { recursive: true })
    await writeFile(join(rootDir, 'server/api/cached.ts'), 'export default () => ({ marker: "cached-route-marker" })')

    const nuxt2 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: `nitro-${nitroViteEnvironment}-2`,
        experimental: { buildCache: true, nitroViteEnvironment },
        dev: false,
        workspaceDir: tmpDir,
      },
    })
    // the buildId is only restored on a cache hit
    expect(nuxt2.options.buildId).toBe(`nitro-${nitroViteEnvironment}-1`)
    await build(nuxt2)

    expect(existsSync(join(outputDir, 'server/index.mjs'))).toBe(true)
    expect(await readdir(join(outputDir, 'public/_nuxt'))).toStrictEqual(clientAssets)

    const serverFiles = await readdir(join(outputDir, 'server'), { recursive: true, withFileTypes: true })
    const serverCode = await Promise.all(serverFiles.filter(f => f.isFile() && f.name.endsWith('.mjs')).map(f => readFile(join(f.parentPath, f.name), 'utf-8')))
    expect(serverCode.some(code => code.includes('cached-route-marker'))).toBe(true)

    // the ssr environment regenerates the inline styles map on a hit, so its
    // keys have to still match the modules the renderer looks up
    const html = await renderIndex(outputDir)
    expect(html).toMatch(INLINE_STYLE_RE)
    expect(html).toBe(expectedHtml)
  })

  it('should hit the cache when only an ignored file changes', async () => {
    const rootDir = join(tmpDir, 'project')

    const nuxt1 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'ignored-1',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
      },
    })
    await build(nuxt1)

    await writeFile(join(rootDir, 'unit.spec.ts'), 'export const marker = 1')

    const nuxt2 = await loadNuxt({
      cwd: rootDir,
      overrides: {
        buildId: 'ignored-2',
        experimental: { buildCache: true },
        dev: false,
        workspaceDir: tmpDir,
      },
    })
    expect(nuxt2.options.buildId).toBe('ignored-1')
    await build(nuxt2)

    const latestJson = JSON.parse(await readFile(join(nuxt2.options.buildDir, 'manifest', 'latest.json'), 'utf-8'))
    expect(latestJson.id).toBe('ignored-1')
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
