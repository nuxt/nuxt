import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
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

  beforeAll(async () => {
    await Promise.all([
      exec('pnpm', ['nuxt', 'build', rootDir]),
      exec('pnpm', ['nuxt', 'build', pagesRootDir]),
    ])
  }, 120 * 1000)

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

  it('default server bundle size', async () => {
    const serverDir = join(rootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!_libs'], serverDir, rootDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"70.3k"`)

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
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"172k"`)

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

describe.skipIf(isStubbed || process.env.SKIP_BUNDLE_SIZE === 'true' || process.env.ECOSYSTEM_CI)('minimal nuxt install size', () => {
  it('installed node_modules size', async () => {
    const nuxtVersion = JSON.parse(
      await fsp.readFile(fileURLToPath(new URL('../packages/nuxt/package.json', import.meta.url)), 'utf8'),
    ).version

    // Install `nuxt` into a throwaway project outside the monorepo so the resolved
    // dependency tree matches what an end user actually gets, rather than this
    // repo's deduped/hoisted workspace install.
    const installDir = join(tmpdir(), 'nuxt-install-size')
    await fsp.rm(installDir, { recursive: true, force: true })
    await fsp.mkdir(installDir, { recursive: true })
    await fsp.writeFile(
      join(installDir, 'package.json'),
      JSON.stringify({ name: 'nuxt-install-size', private: true, dependencies: { nuxt: nuxtVersion } }),
    )
    await exec('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], {
      nodeOptions: { cwd: installDir },
      throwOnError: true,
    })

    const megabytes = await measureInstallSize(join(installDir, 'node_modules'))

    // Reported as CI info rather than asserted as an exact value: the figure drifts
    // as transitive dependencies publish patches within their semver ranges, so it's
    // surfaced for visibility (issue #23487: "info is good enough") instead of being
    // gated as pass/fail. Only sanity bounds are asserted.
    const report = `Minimal \`nuxt@${nuxtVersion}\` install size (excluding platform-specific packages): ${megabytes.toFixed(1)} MB`
    console.info(report)
    if (process.env.GITHUB_STEP_SUMMARY) {
      await fsp.appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
    }

    expect.soft(megabytes).toBeGreaterThan(50)
    expect.soft(megabytes).toBeLessThan(500)
  }, 180 * 1000)
})

/**
 * Sums the on-disk content of a real `node_modules` tree in megabytes. Platform-
 * specific packages (with `os`/`cpu` restrictions, e.g. esbuild/rollup native
 * binaries) are skipped so the figure is stable across CI and local machines
 * regardless of architecture.
 */
async function measureInstallSize (nodeModules: string) {
  let totalBytes = 0

  async function eachPackage (dir: string) {
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) { continue }
      // Scoped packages (`@scope/*`) nest one level deeper than unscoped ones.
      const packageDirs = entry.name.startsWith('@')
        ? (await fsp.readdir(join(dir, entry.name), { withFileTypes: true }))
            .filter(e => e.isDirectory())
            .map(e => join(dir, entry.name, e.name))
        : [join(dir, entry.name)]

      for (const packageDir of packageDirs) {
        const pkg = JSON.parse(await fsp.readFile(join(packageDir, 'package.json'), 'utf8').catch(() => 'null'))
        if (!pkg || pkg.os || pkg.cpu) { continue }
        totalBytes += await dirSize(packageDir)
        await eachPackage(join(packageDir, 'node_modules'))
      }
    }
  }

  await eachPackage(nodeModules)
  return totalBytes / 1024 / 1024
}

async function dirSize (dir: string) {
  let totalBytes = 0
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name === 'node_modules') { continue }
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      totalBytes += await dirSize(path)
    } else if (entry.isFile()) {
      totalBytes += (await fsp.lstat(path)).size
    }
  }
  return totalBytes
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
