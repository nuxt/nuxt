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

  beforeAll(async () => {
    await Promise.all([
      exec('pnpm', ['nuxt', 'build', rootDir]),
      exec('pnpm', ['nuxt', 'build', pagesRootDir]),
    ])
  }, 120 * 1000)

  it('default client bundle size', async () => {
    const clientStats = await analyzeSizes(['**/*.js'], join(rootDir, '.output/public'), rootDir)

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"116k"`)

    const files = clientStats!.files.map(f => f.replace(/\..*\.js/, '.js'))

    expect([...files]).toMatchInlineSnapshot(`
      [
        "_nuxt/entry.js",
      ]
    `)
  })

  it('default client bundle size (pages)', async () => {
    const clientStats = await analyzeSizes(['**/*.js'], join(pagesRootDir, '.output/public'), pagesRootDir)

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"175k"`)

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
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"69.8k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir, rootDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"480k"`)

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
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"279k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir, pagesRootDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"489k"`)

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
        "hookable",
        "ocache+ohash",
        "ofetch",
        "pathe",
        "perfect-debounce",
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

async function analyzeSizes (pattern: string[], rootDir: string, projectDir: string) {
  const files: string[] = await glob(pattern, { cwd: rootDir })
  const hostPathForms = getHostPathForms(projectDir)
  let totalBytes = 0
  for (const file of files) {
    const path = join(rootDir, file)
    const isSymlink = (await fsp.lstat(path).catch(() => null))?.isSymbolicLink()

    if (!isSymlink) {
      const contents = await fsp.readFile(path, 'utf8')
      let normalized = contents
      for (const form of hostPathForms) {
        normalized = normalized.replaceAll(form, '')
      }
      totalBytes += Buffer.byteLength(normalized)
    }
  }
  return { files, totalBytes }
}

// Rolldown encodes a virtual module's absolute path into the JS identifier name as
// `encodeURIComponent(path).replace(/\W/g, '_')`, which leaks the host workspace path
// into `.output/server/_build/server.mjs` and makes byte totals drift between
// `/Users/<me>/...` and `/home/runner/work/nuxt/nuxt`. Strip every form we know can appear
// before measuring so the size is platform-independent.
function getHostPathForms (projectDir: string) {
  const encoded = encodeURIComponent(projectDir)
  return [
    projectDir,
    encoded,
    encoded.replace(/\W/g, '_'),
  ]
}

function roundToKilobytes (bytes: number) {
  return (bytes / 1024).toFixed(bytes > (100 * 1024) ? 0 : 1) + 'k'
}
