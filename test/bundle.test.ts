import { fileURLToPath } from 'node:url'
import fsp from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { execaCommand } from 'execa'
import { globby } from 'globby'
import { join } from 'pathe'

describe.skipIf(process.env.SKIP_BUNDLE_SIZE === 'true' || process.env.ECOSYSTEM_CI)('minimal nuxt application', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/minimal', import.meta.url))

  beforeAll(async () => {
    await Promise.all([
      execaCommand(`pnpm nuxi build ${rootDir}`, { env: { EXTERNAL_VUE: 'false' } }),
      execaCommand(`pnpm nuxi build ${rootDir}`, { env: { EXTERNAL_VUE: 'true' } })
    ])
  }, 120 * 1000)

  // Identical behaviour between inline/external vue options as this should only affect the server build
  for (const outputDir of ['.output', '.output-inline']) {
    it('default client bundle size', async () => {
      const clientStats = await analyzeSizes('**/*.js', join(rootDir, outputDir, 'public'))
      expect.soft(roundToKilobytes(clientStats.totalBytes)).toMatchInlineSnapshot('"97.4k"')
      expect(clientStats.files.map(f => f.replace(/\..*\.js/, '.js'))).toMatchInlineSnapshot(`
        [
          "_nuxt/entry.js",
        ]
      `)
    })
  }

  it('default server bundle size', async () => {
    const serverDir = join(rootDir, '.output/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!node_modules'], serverDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot('"64.4k"')

    const modules = await analyzeSizes('node_modules/**/*', serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot('"2331k"')

    const packages = modules.files
      .filter(m => m.endsWith('package.json'))
      .map(m => m.replace('/package.json', '').replace('node_modules/', ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@babel/parser",
        "@unhead/dom",
        "@unhead/shared",
        "@unhead/ssr",
        "@vue/compiler-core",
        "@vue/compiler-dom",
        "@vue/compiler-ssr",
        "@vue/reactivity",
        "@vue/runtime-core",
        "@vue/runtime-dom",
        "@vue/server-renderer",
        "@vue/shared",
        "cookie-es",
        "debug",
        "defu",
        "destr",
        "devalue",
        "estree-walker",
        "h3",
        "has-flag",
        "hookable",
        "http-graceful-shutdown",
        "iron-webcrypto",
        "klona",
        "ms",
        "node-fetch-native",
        "ofetch",
        "ohash",
        "pathe",
        "radix3",
        "scule",
        "source-map-js",
        "supports-color",
        "ufo",
        "uncrypto",
        "unctx",
        "unenv",
        "unhead",
        "unstorage",
        "vue",
        "vue-bundle-renderer",
      ]
    `)
  })

  it('default server bundle size (inlined vue modules)', async () => {
    const serverDir = join(rootDir, '.output-inline/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!node_modules'], serverDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot('"370k"')

    const modules = await analyzeSizes('node_modules/**/*', serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot('"593k"')

    const packages = modules.files
      .filter(m => m.endsWith('package.json'))
      .map(m => m.replace('/package.json', '').replace('node_modules/', ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@unhead/dom",
        "@unhead/shared",
        "@unhead/ssr",
        "cookie-es",
        "debug",
        "defu",
        "destr",
        "devalue",
        "h3",
        "has-flag",
        "hookable",
        "http-graceful-shutdown",
        "iron-webcrypto",
        "klona",
        "ms",
        "node-fetch-native",
        "ofetch",
        "ohash",
        "pathe",
        "radix3",
        "scule",
        "supports-color",
        "ufo",
        "uncrypto",
        "unctx",
        "unenv",
        "unhead",
        "unstorage",
      ]
    `)
  })
})

async function analyzeSizes (pattern: string | string[], rootDir: string) {
  const files: string[] = await globby(pattern, { cwd: rootDir })
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
