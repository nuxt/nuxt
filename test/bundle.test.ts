import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import fsp from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { glob } from 'tinyglobby'
import { join } from 'pathe'

const nuxtEntry = fileURLToPath(new URL('../packages/nuxt/dist/index.mjs', import.meta.url))
const isStubbed = readFileSync(nuxtEntry, 'utf-8').includes('const _module = await jiti')

describe.skipIf(isStubbed || process.env.SKIP_BUNDLE_SIZE === 'true' || process.env.ECOSYSTEM_CI)('minimal nuxt application', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/minimal', import.meta.url))
  const pagesRootDir = fileURLToPath(new URL('./fixtures/minimal-pages', import.meta.url))
  const manyRoutesRootDir = fileURLToPath(new URL('./fixtures/minimal-pages-many-routes', import.meta.url))
  const lazyPagesRootDir = fileURLToPath(new URL('./fixtures/minimal-pages-lazy-routes', import.meta.url))

  beforeAll(async () => {
    await Promise.all([
      exec('pnpm', ['nuxt', 'build', rootDir]),
      exec('pnpm', ['nuxt', 'build', pagesRootDir]),
      exec('pnpm', ['nuxt', 'build', manyRoutesRootDir]),
      exec('pnpm', ['nuxt', 'build', lazyPagesRootDir]),
    ])
  }, 240 * 1000)

  it('default client bundle size', async () => {
    const clientStats = await analyzeSizes(['**/*.js'], join(rootDir, '.output/public'), rootDir)

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"117k"`)

    const files = clientStats!.files.map(f => f.replace(/\..*\.js/, '.js'))

    expect([...files]).toMatchInlineSnapshot(`
      [
        "_nuxt/entry.js",
      ]
    `)
  })

  it('default client bundle size (pages)', async () => {
    const clientStats = await analyzeSizes(['**/*.js'], join(pagesRootDir, '.output/public'), pagesRootDir)

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"177k"`)

    const files = clientStats!.files.map(f => f.replace(/\..*\.js/, '.js'))

    expect([...files]).toMatchInlineSnapshot(`
      [
        "_nuxt/a.js",
        "_nuxt/client-component.js",
        "_nuxt/default.js",
        "_nuxt/entry.js",
        "_nuxt/pages.js",
        "_nuxt/runtime-core.js",
        "_nuxt/server-component.js",
      ]
    `)
  })

  it('client entry size shrinks with lazy route discovery', async () => {
    // both fixtures share the same 40+ generated routes; only the flag differs
    const [entrySize, baselineEntrySize] = await Promise.all([
      entryBytes(join(lazyPagesRootDir, '.output/public'), lazyPagesRootDir),
      entryBytes(join(manyRoutesRootDir, '.output/public'), manyRoutesRootDir),
    ])
    expect(entrySize).toBeLessThan(baselineEntrySize)

    const lazyStats = await analyzeSizes(['**/*.js'], join(lazyPagesRootDir, '.output/public'), lazyPagesRootDir)
    const baselineStats = await analyzeSizes(['**/*.js'], join(manyRoutesRootDir, '.output/public'), manyRoutesRootDir)

    // the full route table stays a single entry graph, whereas lazy discovery batches
    // route records into lazily-loaded group chunks (default 10 records per group)
    const extraChunks = lazyStats.files.length - baselineStats.files.length
    expect(extraChunks).toBeGreaterThanOrEqual(4)

    expect.soft(roundToKilobytes(entrySize)).toMatchInlineSnapshot(`"88.2k"`)
    expect.soft(roundToKilobytes(baselineEntrySize)).toMatchInlineSnapshot(`"99.3k"`)
  })

  it('default server bundle size', async () => {
    const serverDir = join(rootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!_libs'], serverDir, rootDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"70.7k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir, rootDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"482k"`)

    const packages = modules.files
      .map(m => m.replace('_libs/', '').replace(/\.mjs$/, ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@unhead/vue+[...]",
        "defu",
        "destr",
        "devalue",
        "h3+rou3+srvx",
        "ocache+ohash",
        "ofetch",
        "pathe",
        "scule",
        "ufo",
        "unctx",
        "unhead",
        "unstorage",
        "vue",
        "vue-bundle-renderer",
        "vue__server-renderer",
      ]
    `)
  })

  it('default server bundle size (pages)', async () => {
    const serverDir = join(pagesRootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!_libs'], serverDir, pagesRootDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"173k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir, pagesRootDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"483k"`)

    const packages = modules.files
      .map(m => m.replace('_libs/', '').replace(/\.mjs$/, ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@unhead/vue+[...]",
        "defu",
        "destr",
        "devalue",
        "h3+rou3+srvx",
        "ocache+ohash",
        "ofetch",
        "pathe",
        "scule",
        "ufo",
        "uncrypto",
        "unctx",
        "unhead",
        "unstorage",
        "vue",
        "vue-bundle-renderer",
        "vue__server-renderer",
      ]
    `)
  })
})

async function entryBytes (publicDir: string, projectDir: string) {
  const [entry] = await glob(['_nuxt/entry.*.js', '_nuxt/entry.js'], { cwd: publicDir })
  expect(entry).toBeTruthy()
  const contents = await fsp.readFile(join(publicDir, entry!), 'utf8')
  let normalized = contents
  for (const pattern of getStripPatterns(projectDir)) {
    normalized = normalized.replaceAll(pattern, '')
  }
  return Buffer.byteLength(normalized)
}

async function analyzeSizes (pattern: string[], rootDir: string, projectDir: string) {
  const files: string[] = await glob(pattern, { cwd: rootDir })
  const stripPatterns = getStripPatterns(projectDir)
  let totalBytes = 0
  for (const file of files) {
    const path = join(rootDir, file)
    const isSymlink = (await fsp.lstat(path).catch(() => null))?.isSymbolicLink()

    if (!isSymlink) {
      const contents = await fsp.readFile(path, 'utf8')
      let normalized = contents
      for (const pattern of stripPatterns) {
        normalized = normalized.replaceAll(pattern, '')
      }
      totalBytes += Buffer.byteLength(normalized)
    }
  }
  return { files, totalBytes }
}

// Strip strings that vary by host or by build invocation but don't represent real bundle
// content, so the byte count is stable across machines and consecutive builds.
//
// 1. `projectDir`: leaks into rolldown-generated identifier names. Rolldown turns a virtual
//    module's absolute path into a JS identifier as
//    `encodeURIComponent(path).replace(/\W/g, '_')`, so the raw, URL-encoded, and mangled
//    forms can all appear in `.output/server/_build/server.mjs`.
//
// 2. `node_modules/.cache/nuxt/`: `@nuxt/kit` config loader flips `buildDir` from
//    `<rootDir>/.nuxt` to `<rootDir>/node_modules/.cache/nuxt/.nuxt` when `.nuxt/` already
//    exists at config-load time (the production-build-after-prior-build case), so the same
//    fixture produces different bytes on first build vs second build on the same machine.
//    The prefix shows up both in `//#region` chunk comments and inside mangled virtual-
//    module identifiers.
function getStripPatterns (projectDir: string) {
  return [
    ...allForms(projectDir),
    ...allForms('node_modules/.cache/nuxt/'),
  ]
}

function allForms (value: string) {
  const encoded = encodeURIComponent(value)
  return [value, encoded, encoded.replace(/\W/g, '_')]
}

function roundToKilobytes (bytes: number) {
  return (bytes / 1024).toFixed(bytes > (100 * 1024) ? 0 : 1) + 'k'
}
