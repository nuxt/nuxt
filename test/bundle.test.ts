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

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"108k"`)
    expect.soft(roundToKilobytes(clientStats!.gzipBytes)).toMatchInlineSnapshot(`"40.2k"`)

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

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"182k"`)

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
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"267k"`)

    const packages = getVendorPackages(await glob(['_libs/**/*'], { cwd: serverDir }))
    expect(packages).toMatchInlineSnapshot(`
      [
        "_vue/server-renderer+[...]",
        "defu",
        "devalue",
        "h3+rou3+srvx",
        "hookable",
        "ocache+ohash",
        "ofetch",
        "scule",
        "ufo",
        "unstorage",
        "vue",
        "vue__reactivity+vue__shared",
        "vue__runtime-core",
        "vue__runtime-dom",
      ]
    `)
  })

  it('default server bundle size (pages)', async () => {
    const serverDir = join(pagesRootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs'], serverDir, pagesRootDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"313k"`)

    const packages = getVendorPackages(await glob(['_libs/**/*'], { cwd: serverDir }))
    expect(packages).toMatchInlineSnapshot(`
      [
        "_vue/server-renderer+[...]",
        "defu",
        "devalue",
        "h3+rou3+srvx",
        "hookable",
        "ocache+ohash",
        "ofetch",
        "scule",
        "ufo",
        "unstorage",
        "vue",
        "vue-router",
        "vue__reactivity+vue__shared",
        "vue__runtime-core",
        "vue__runtime-dom",
      ]
    `)
  })

  it('splits page components by the environment they can render in', async () => {
    const server = (await Promise.all(
      (await glob(['**/*.mjs'], { cwd: join(pagesRootDir, '.output/server') }))
        .map(file => fsp.readFile(join(pagesRootDir, '.output/server', file), 'utf8')),
    )).join('\n')
    const client = (await Promise.all(
      (await glob(['**/*.js'], { cwd: join(pagesRootDir, '.output/public') }))
        .map(file => fsp.readFile(join(pagesRootDir, '.output/public', file), 'utf8')),
    )).join('\n')

    expect(server).not.toContain('Client-only page')
    expect(client).toContain('Client-only page')

    expect(server).toContain('Server-only page')
    expect(client).not.toContain('Server-only page')
  })
})

describe.skipIf(process.env.SKIP_BUNDLE_SIZE === 'true' || process.env.ECOSYSTEM_CI)('noScripts route rules', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/no-scripts', import.meta.url))

  beforeAll(async () => {
    await exec('pnpm', ['nuxt', 'build', rootDir])
  }, 120 * 1000)

  it('drops components of noScripts pages from the client bundle', async () => {
    const dir = join(rootDir, '.output/public')
    const bundle = (await Promise.all(
      (await glob(['**/*.js'], { cwd: dir })).map(file => fsp.readFile(join(dir, file), 'utf8')),
    )).join('\n')

    // a flat and a dynamic-param page, both covered by a `noScripts` rule, are
    // replaced by the reload stub, so their component markers never ship
    expect(bundle).not.toContain('no-scripts-page')
    expect(bundle).not.toContain('product-page')

    // a nested child route (relative path resolved against its parent), and the
    // parent shell it renders inside
    expect(bundle).not.toContain('dashstatsheading')
    expect(bundle).not.toContain('dash-page')

    // the default and named views of a `noScripts` route are both stubbed
    expect(bundle).not.toContain('report-default')
    expect(bundle).not.toContain('report-aux')

    // a page whose canonical path is `noScripts` but which has a scripted alias
    // keeps its component so the alias can still render client-side
    expect(bundle).toContain('aliased-page')
  })
})

describe.skipIf(process.env.SKIP_BUNDLE_SIZE === 'true' || process.env.ECOSYSTEM_CI)('ssr: false route rules', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/spa-only', import.meta.url))

  beforeAll(async () => {
    await exec('pnpm', ['nuxt', 'build', rootDir])
  }, 120 * 1000)

  it('drops components of client-only pages from the server bundle', async () => {
    const dir = join(rootDir, '.output/server')
    const bundle = (await Promise.all(
      (await glob(['**/*.mjs'], { cwd: dir })).map(file => fsp.readFile(join(dir, file), 'utf8')),
    )).join('\n')

    // a flat page, a dynamic-param page, an inline `defineRouteRules` page and a
    // nested child, all inside a client-only region
    expect(bundle).not.toContain('admin-index-page')
    expect(bundle).not.toContain('product-page')
    expect(bundle).not.toContain('inline-page')
    expect(bundle).not.toContain('parent-nested-page')

    // the default and named views of a client-only route are both stubbed
    expect(bundle).not.toContain('report-default')
    expect(bundle).not.toContain('report-aux')

    // a more specific `ssr: true` rule, and a child escaping its parent's region
    // via an absolute path, each keep their own page and the parent shell
    expect(bundle).toContain('admin-ssr-page')
    expect(bundle).toContain('admin-shell')
    expect(bundle).toContain('escaped-page')
    expect(bundle).toContain('parent-shell')

    // a client-only canonical path with a server-rendered alias
    expect(bundle).toContain('aliased-page')

    expect(bundle).toContain('index-page')
  })

  it('keeps client-only page code in the client bundle', async () => {
    const dir = join(rootDir, '.output/public')
    const bundle = (await Promise.all(
      (await glob(['**/*.js'], { cwd: dir })).map(file => fsp.readFile(join(dir, file), 'utf8')),
    )).join('\n')

    expect(bundle).toContain('admin-index-page')
    expect(bundle).toContain('product-page')
    expect(bundle).toContain('inline-page')
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
