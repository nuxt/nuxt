import { fileURLToPath } from 'node:url'
import fsp from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { glob } from 'tinyglobby'
import { join } from 'pathe'

describe.skipIf(process.env.SKIP_BUNDLE_SIZE === 'true' || process.env.ECOSYSTEM_CI)('minimal nuxt application', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/minimal', import.meta.url))
  const pagesRootDir = fileURLToPath(new URL('./fixtures/minimal-pages', import.meta.url))
  const spaRootDir = fileURLToPath(new URL('./fixtures/spa', import.meta.url))

  beforeAll(async () => {
    await Promise.all([
      exec('pnpm', ['nuxt', 'build', rootDir]),
      exec('pnpm', ['nuxt', 'build', pagesRootDir]),
      exec('pnpm', ['nuxt', 'build', spaRootDir]),
    ])
  }, 120 * 1000)

  it('default client bundle size', async () => {
    const clientStats = await analyzeSizes(['**/*.js'], join(rootDir, '.output/public'), rootDir)

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"106k"`)
    expect.soft(roundToKilobytes(clientStats!.gzipBytes)).toMatchInlineSnapshot(`"39.5k"`)

    const entry = await fsp.readFile(join(rootDir, '.output/public', clientStats!.files.find(f => f.startsWith('_nuxt/entry'))!), 'utf8')
    expect(entry).not.toContain('[ofetch] global.fetch is not supported')

    const files = clientStats!.files.map(f => f.replace(/\..*\.js/, '.js'))

    expect([...files]).toMatchInlineSnapshot(`
      [
        "_nuxt/entry.js",
      ]
    `)
  })

  it('does not ship payload revival machinery in a spa build', async () => {
    const clientStats = await analyzeSizes(['**/*.js'], join(spaRootDir, '.output/public'), spaRootDir)

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"101k"`)

    const contents = await Promise.all(
      (await glob(['**/*.js'], { cwd: join(spaRootDir, '.output/public') }))
        .map(file => fsp.readFile(join(spaRootDir, '.output/public', file), 'utf8')),
    )
    const bundle = contents.join('\n')

    expect(bundle).not.toContain('nuxt:revive-payload:client')
    expect(bundle).not.toContain('EmptyShallowRef')
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

  it('default server bundle size', async () => {
    const serverDir = join(rootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs'], serverDir, rootDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"272k"`)

    const packages = getVendorPackages(await glob(['_libs/**/*'], { cwd: serverDir }))
    expect(packages).toMatchInlineSnapshot(`
      [
        "@unhead/vue+[...]",
        "defu",
        "destr",
        "devalue",
        "h3+rou3+srvx",
        "nostics",
        "ocache+ohash",
        "ofetch",
        "pathe",
        "scule",
        "ufo",
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

    const serverStats = await analyzeSizes(['**/*.mjs'], serverDir, pagesRootDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"345k"`)

    const packages = getVendorPackages(await glob(['_libs/**/*'], { cwd: serverDir }))
    expect(packages).toMatchInlineSnapshot(`
      [
        "@unhead/vue+[...]",
        "defu",
        "destr",
        "devalue",
        "h3+rou3+srvx",
        "nostics",
        "ocache+ohash",
        "ofetch",
        "pathe",
        "scule",
        "ufo",
        "uncrypto",
        "unhead",
        "unstorage",
        "vue",
        "vue-bundle-renderer",
        "vue-devtools-stub",
        "vue-router",
        "vue__server-renderer",
      ]
    `)
  })
})

// we strip packages that are small enough rolldown might inline them
// depending on humidity or the time of day
const MERGE_BOUNDARY_PACKAGES = new Set(['unctx'])

function getVendorPackages (files: string[]) {
  return files
    .map(m => m.replace('_libs/', '').replace(/\.mjs$/, ''))
    .filter(pkg => !MERGE_BOUNDARY_PACKAGES.has(pkg))
    .sort()
}

async function analyzeSizes (pattern: string[], rootDir: string, projectDir: string) {
  const files: string[] = await glob(pattern, { cwd: rootDir })
  const stripPatterns = getStripPatterns(projectDir)
  let totalBytes = 0
  let gzipBytes = 0
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
      gzipBytes += gzipSync(normalized).byteLength
    }
  }
  return { files, totalBytes, gzipBytes }
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
