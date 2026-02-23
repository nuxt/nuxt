import { fileURLToPath } from 'node:url'
import fsp from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { glob } from 'tinyglobby'
import { join } from 'pathe'

describe.skipIf(process.env.SKIP_BUNDLE_SIZE === 'true' || process.env.ECOSYSTEM_CI)('minimal nuxt application', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/minimal', import.meta.url))
  const pagesRootDir = fileURLToPath(new URL('./fixtures/minimal-pages', import.meta.url))

  beforeAll(async () => {
    await Promise.all([
      exec('pnpm', ['nuxt', 'build', rootDir], { nodeOptions: { env: { EXTERNAL_VUE: 'false' } } }),
      exec('pnpm', ['nuxt', 'build', rootDir], { nodeOptions: { env: { EXTERNAL_VUE: 'true' } } }),
      exec('pnpm', ['nuxt', 'build', pagesRootDir]),
    ])
  }, 120 * 1000)

  // Identical behaviour between inline/external vue options as this should only affect the server build

  it('default client bundle size', async () => {
    const [clientStats, clientStatsInlined] = await Promise.all((['.output', '.output-inline'])
      .map(outputDir => analyzeSizes(['**/*.js'], join(rootDir, outputDir, 'public'))))

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"117k"`)
    expect.soft(roundToKilobytes(clientStatsInlined!.totalBytes)).toMatchInlineSnapshot(`"117k"`)

    const files = new Set([...clientStats!.files, ...clientStatsInlined!.files].map(f => f.replace(/\..*\.js/, '.js')))

    expect([...files]).toMatchInlineSnapshot(`
      [
        "_nuxt/entry.js",
      ]
    `)
  })

  it('default client bundle size (pages)', async () => {
    const clientStats = await analyzeSizes(['**/*.js'], join(pagesRootDir, '.output/public'))

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"178k"`)

    const files = clientStats!.files.map(f => f.replace(/\..*\.js/, '.js'))

    expect([...files]).toMatchInlineSnapshot(`
      [
        "_nuxt/a.js",
        "_nuxt/client-component.js",
        "_nuxt/default.js",
        "_nuxt/entry.js",
        "_nuxt/index.js",
        "_nuxt/server-component.js",
      ]
    `)
  })

  it('default server bundle size', async () => {
    const serverDir = join(rootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!_libs'], serverDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"72.3k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"1491k"`)

    const packages = modules.files
      .map(m => m.replace('_libs/', '').replace(/\.mjs$/, ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@vue/server-renderer",
        "@vue/shared",
        "babel__parser",
        "croner",
        "crossws",
        "defu",
        "destr",
        "devalue",
        "entities",
        "estree-walker",
        "h3",
        "hookable",
        "nuxt__devalue",
        "ofetch",
        "ohash",
        "pathe",
        "rou3",
        "scule",
        "source-map-js",
        "srvx",
        "ufo",
        "unctx",
        "unhead",
        "unhead__vue",
        "unstorage",
        "vue",
        "vue-bundle-renderer",
        "vue__compiler-core",
        "vue__compiler-dom",
        "vue__compiler-ssr",
        "vue__reactivity",
        "vue__runtime-core",
        "vue__runtime-dom",
      ]
    `)
  })

  it('default server bundle size (inlined vue modules)', async () => {
    const serverDir = join(rootDir, '.output-inline/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!_libs'], serverDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"72.0k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"527k"`)

    const packages = modules.files
      .map(m => m.replace('_libs/', '').replace(/\.mjs$/, ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@vue/server-renderer",
        "@vue/shared",
        "croner",
        "crossws",
        "defu",
        "destr",
        "devalue",
        "h3",
        "hookable",
        "mocked-exports",
        "nuxt__devalue",
        "ofetch",
        "ohash",
        "pathe",
        "rou3",
        "scule",
        "srvx",
        "ufo",
        "unctx",
        "unhead",
        "unhead__vue",
        "unstorage",
        "vue",
        "vue-bundle-renderer",
        "vue__reactivity",
        "vue__runtime-core",
        "vue__runtime-dom",
      ]
    `)
  })

  it('default server bundle size (pages)', async () => {
    const serverDir = join(pagesRootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!_libs'], serverDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"177k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"1493k"`)

    const packages = modules.files
      .map(m => m.replace('_libs/', '').replace(/\.mjs$/, ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@vue/server-renderer",
        "@vue/shared",
        "babel__parser",
        "croner",
        "crossws",
        "defu",
        "destr",
        "devalue",
        "entities",
        "estree-walker",
        "h3",
        "hookable",
        "nuxt__devalue",
        "ofetch",
        "ohash",
        "pathe",
        "rou3",
        "scule",
        "source-map-js",
        "srvx",
        "ufo",
        "uncrypto",
        "unctx",
        "unhead",
        "unhead__vue",
        "unstorage",
        "vue",
        "vue-bundle-renderer",
        "vue__compiler-core",
        "vue__compiler-dom",
        "vue__compiler-ssr",
        "vue__reactivity",
        "vue__runtime-core",
        "vue__runtime-dom",
      ]
    `)
  })
})

async function analyzeSizes (pattern: string[], rootDir: string) {
  const files: string[] = await glob(pattern, { cwd: rootDir })
  let totalBytes = 0
  for (const file of files) {
    const path = join(rootDir, file)
    const isSymlink = (await fsp.lstat(path).catch(() => null))?.isSymbolicLink()

    if (!isSymlink) {
      const bytes = Buffer.byteLength(await fsp.readFile(path))
      totalBytes += bytes
    }
  }
  return { files, totalBytes }
}

function roundToKilobytes (bytes: number) {
  return (bytes / 1024).toFixed(bytes > (100 * 1024) ? 0 : 1) + 'k'
}
