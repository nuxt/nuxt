import { fileURLToPath } from 'node:url'
import fsp from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { glob } from 'tinyglobby'
import { join } from 'pathe'

describe.skipIf(process.env.SKIP_BUNDLE_SIZE === 'true' || process.env.ECOSYSTEM_CI)('minimal nuxt application', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/minimal', import.meta.url))

  beforeAll(async () => {
    await Promise.all([
      exec('pnpm', ['nuxi', 'build', rootDir], { nodeOptions: { env: { EXTERNAL_VUE: 'false' } } }),
      exec('pnpm', ['nuxi', 'build', rootDir], { nodeOptions: { env: { EXTERNAL_VUE: 'true' } } }),
    ])
  }, 120 * 1000)

  // Identical behaviour between inline/external vue options as this should only affect the server build
  for (const outputDir of ['.output', '.output-inline']) {
    it('default client bundle size', async () => {
      const clientStats = await analyzeSizes(['**/*.js'], join(rootDir, outputDir, 'public'))
      expect.soft(roundToKilobytes(clientStats.totalBytes)).toMatchInlineSnapshot(`"108k"`)
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
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"205k"`)

    const modules = await analyzeSizes(['node_modules/**/*'], serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"1355k"`)

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
        "db0",
        "devalue",
        "entities",
        "estree-walker",
        "hookable",
        "source-map-js",
        "ufo",
        "unhead",
        "vue",
        "vue-bundle-renderer",
      ]
    `)
  })

  it('default server bundle size (inlined vue modules)', async () => {
    const serverDir = join(rootDir, '.output-inline/server')

    const serverStats = await analyzeSizes(['**/*.mjs', '!node_modules'], serverDir)
    expect.soft(roundToKilobytes(serverStats.totalBytes)).toMatchInlineSnapshot(`"529k"`)

    const modules = await analyzeSizes(['node_modules/**/*'], serverDir)
    expect.soft(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot(`"86.1k"`)

    const packages = modules.files
      .filter(m => m.endsWith('package.json'))
      .map(m => m.replace('/package.json', '').replace('node_modules/', ''))
      .sort()
    expect(packages).toMatchInlineSnapshot(`
      [
        "@unhead/dom",
        "@unhead/shared",
        "@unhead/ssr",
        "db0",
        "devalue",
        "hookable",
        "unhead",
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
