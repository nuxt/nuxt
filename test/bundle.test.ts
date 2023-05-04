import { fileURLToPath } from 'node:url'
import fsp from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execaCommand } from 'execa'
import { globby } from 'globby'
import { join } from 'pathe'
import { isWindows } from 'std-env'
import { isRenderingJson } from './utils'

// We only want to run this test for:
// - ubuntu
// - vite
// - in our own CI
// - using JS (default) payload rendering
// - production build

describe.skipIf(isWindows || process.env.TEST_BUILDER === 'webpack' || process.env.ECOSYSTEM_CI || !isRenderingJson || process.env.TEST_ENV === 'dev')('minimal nuxt application', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/minimal', import.meta.url))
  const publicDir = join(rootDir, '.output/public')
  const serverDir = join(rootDir, '.output/server')

  const stats = {
    client: { totalBytes: 0, files: [] as string[] },
    server: { totalBytes: 0, files: [] as string[] }
  }

  beforeAll(async () => {
    await execaCommand(`pnpm nuxi build ${rootDir}`)
  }, 120 * 1000)

  afterAll(async () => {
    await fsp.writeFile(join(rootDir, '.output/test-stats.json'), JSON.stringify(stats, null, 2))
  })

  it('default client bundle size', async () => {
    stats.client = await analyzeSizes('**/*.js', publicDir)
    expect(roundToKilobytes(stats.client.totalBytes)).toMatchInlineSnapshot('"94.1k"')
    expect(stats.client.files.map(f => f.replace(/\..*\.js/, '.js'))).toMatchInlineSnapshot(`
      [
        "_nuxt/entry.js",
        "_nuxt/error-component.js",
      ]
    `)
  })

  it('default server bundle size', async () => {
    stats.server = await analyzeSizes(['**/*.mjs', '!node_modules'], serverDir)
    expect(roundToKilobytes(stats.server.totalBytes)).toMatchInlineSnapshot('"66.7k"')

    const modules = await analyzeSizes('node_modules/**/*', serverDir)
    expect(roundToKilobytes(modules.totalBytes)).toMatchInlineSnapshot('"2654k"')

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
        "defu",
        "destr",
        "devalue",
        "estree-walker",
        "h3",
        "hookable",
        "iron-webcrypto",
        "node-fetch-native",
        "ofetch",
        "ohash",
        "pathe",
        "radix3",
        "scule",
        "source-map",
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
