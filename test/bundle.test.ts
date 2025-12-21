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

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"113k"`)
    expect.soft(roundToKilobytes(clientStatsInlined!.totalBytes)).toMatchInlineSnapshot(`"113k"`)

    const files = new Set([...clientStats!.files, ...clientStatsInlined!.files].map(f => f.replace(/\..*\.js/, '.js')))

    expect([...files]).toMatchInlineSnapshot(`
      [
        "_nuxt/entry.js",
      ]
    `)
  })

  it('default client bundle size (pages)', async () => {
    const clientStats = await analyzeSizes(['**/*.js'], join(pagesRootDir, '.output/public'))

    expect.soft(roundToKilobytes(clientStats!.totalBytes)).toMatchInlineSnapshot(`"173k"`)

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
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"43.6k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"1503k"`)

    const packages = modules.files
      .map(m => m.replace('_libs/', ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@babel/parser.mjs",
        "@nuxt/devalue.mjs",
        "@unhead/vue.mjs",
        "@vue/compiler-core.mjs",
        "@vue/compiler-dom.mjs",
        "@vue/compiler-ssr.mjs",
        "@vue/reactivity.mjs",
        "@vue/runtime-core.mjs",
        "@vue/runtime-dom.mjs",
        "@vue/server-renderer.mjs",
        "@vue/shared.mjs",
        "croner.mjs",
        "crossws.mjs",
        "defu.mjs",
        "destr.mjs",
        "devalue.mjs",
        "entities.mjs",
        "estree-walker.mjs",
        "h3.mjs",
        "hookable.mjs",
        "nitro.mjs",
        "ofetch.mjs",
        "ohash.mjs",
        "pathe.mjs",
        "rou3.mjs",
        "scule.mjs",
        "source-map-js.mjs",
        "srvx.mjs",
        "ufo.mjs",
        "unctx.mjs",
        "unhead.mjs",
        "unstorage.mjs",
        "vue-bundle-renderer.mjs",
        "vue.mjs",
      ]
    `)
  })

  it('default server bundle size (inlined vue modules)', async () => {
    const serverDir = join(rootDir, '.output-inline/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!_libs'], serverDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"43.4k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"539k"`)

    const packages = modules.files
      .map(m => m.replace('_libs/', ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@nuxt/devalue.mjs",
        "@unhead/vue.mjs",
        "@vue/reactivity.mjs",
        "@vue/runtime-core.mjs",
        "@vue/runtime-dom.mjs",
        "@vue/server-renderer.mjs",
        "@vue/shared.mjs",
        "croner.mjs",
        "crossws.mjs",
        "defu.mjs",
        "destr.mjs",
        "devalue.mjs",
        "h3.mjs",
        "hookable.mjs",
        "mocked-exports.mjs",
        "nitro.mjs",
        "ofetch.mjs",
        "ohash.mjs",
        "pathe.mjs",
        "rou3.mjs",
        "scule.mjs",
        "srvx.mjs",
        "ufo.mjs",
        "unctx.mjs",
        "unhead.mjs",
        "unstorage.mjs",
        "vue-bundle-renderer.mjs",
        "vue.mjs",
      ]
    `)
  })

  it('default server bundle size (pages)', async () => {
    const serverDir = join(pagesRootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!_libs'], serverDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"142k"`)

    const modules = await analyzeSizes(['_libs/**/*'], serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"1516k"`)

    const packages = modules.files
      .map(m => m.replace('_libs/', ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@babel/parser.mjs",
        "@nuxt/devalue.mjs",
        "@unhead/vue.mjs",
        "@vue/compiler-core.mjs",
        "@vue/compiler-dom.mjs",
        "@vue/compiler-ssr.mjs",
        "@vue/reactivity.mjs",
        "@vue/runtime-core.mjs",
        "@vue/runtime-dom.mjs",
        "@vue/server-renderer.mjs",
        "@vue/shared.mjs",
        "croner.mjs",
        "crossws.mjs",
        "defu.mjs",
        "destr.mjs",
        "devalue.mjs",
        "entities.mjs",
        "estree-walker.mjs",
        "h3.mjs",
        "hookable.mjs",
        "nitro.mjs",
        "ofetch.mjs",
        "ohash.mjs",
        "pathe.mjs",
        "rou3.mjs",
        "scule.mjs",
        "source-map-js.mjs",
        "srvx.mjs",
        "ufo.mjs",
        "uncrypto.mjs",
        "unctx.mjs",
        "unhead.mjs",
        "unstorage.mjs",
        "vue-bundle-renderer.mjs",
        "vue.mjs",
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
