import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

import { findWorkspaceDir } from 'pkg-types'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { build, loadNuxt } from 'nuxt'

type Builder = 'vite' | 'webpack' | 'rspack'

const repoRoot = await findWorkspaceDir()
const fixtureRoots: string[] = []

describe('build options', { sequential: true }, () => {
  afterEach(async () => {
    await Promise.all(fixtureRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  })

  it('skips client bundle and public assets with build.client: false', async () => {
    const { rootDir, buildLog } = await createFixture({
      build: {
        client: false,
      },
    })

    await buildFixture(rootDir)

    expect(await readFile(buildLog, 'utf8')).toBe('server\n')
    expect(existsSync(join(rootDir, '.nuxt/dist/server/server.mjs'))).toBe(true)
    expect(existsSync(join(rootDir, '.nuxt/dist/client'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/server'))).toBe(true)
    expect(existsSync(join(rootDir, '.output/server/_virtual/client.precomputed.mjs'))).toBe(true)
    expect(existsSync(join(rootDir, '.output/public'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/public/_nuxt'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/public/skip-me.txt'))).toBe(false)
  }, 60_000)

  it.each(['webpack', 'rspack'] as const)('skips client bundle and public assets with build.client: false for %s', async (builder) => {
    const { rootDir, buildLog } = await createFixture({
      builder,
      build: {
        client: false,
      },
    })

    await buildFixture(rootDir)

    expect(await readFile(buildLog, 'utf8')).toBe('server\n')
    expect(existsSync(join(rootDir, '.nuxt/dist/server/server.mjs'))).toBe(true)
    expect(existsSync(join(rootDir, '.nuxt/dist/client'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/server'))).toBe(true)
    expect(existsSync(join(rootDir, '.output/server/_virtual/client.precomputed.mjs'))).toBe(true)
    expect(existsSync(join(rootDir, '.output/public'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/public/_nuxt'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/public/skip-me.txt'))).toBe(false)
  }, 60_000)

  it.each(['webpack', 'rspack'] as const)('skips client bundle with vue.runtimeCompiler for %s', async (builder) => {
    const { rootDir, buildLog } = await createFixture({
      builder,
      build: {
        client: false,
      },
      runtimeCompiler: true,
    })

    await buildFixture(rootDir)

    expect(await readFile(buildLog, 'utf8')).toBe('server\n')
    expect(existsSync(join(rootDir, '.nuxt/dist/client'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/server'))).toBe(true)
  }, 60_000)

  it('skips Vue server renderer bundle with build.server: false', async () => {
    const { rootDir, buildLog } = await createFixture({
      build: {
        server: false,
      },
    })

    await buildFixture(rootDir)

    expect(await readFile(buildLog, 'utf8')).toBe('client\n')
    expect(existsSync(join(rootDir, '.nuxt/dist/client'))).toBe(true)
    expect(existsSync(join(rootDir, '.nuxt/dist/server/server.mjs'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/server'))).toBe(true)
    expect(existsSync(join(rootDir, '.output/public/_nuxt'))).toBe(true)
    expect(existsSync(join(rootDir, '.output/public/skip-me.txt'))).toBe(true)
  }, 60_000)

  it.each(['webpack', 'rspack'] as const)('skips Vue server renderer bundle with build.server: false for %s', async (builder) => {
    const { rootDir, buildLog } = await createFixture({
      builder,
      build: {
        server: false,
      },
    })

    await buildFixture(rootDir)

    expect(await readFile(buildLog, 'utf8')).toBe('client\n')
    expect(existsSync(join(rootDir, '.nuxt/dist/client'))).toBe(true)
    expect(existsSync(join(rootDir, '.nuxt/dist/server/server.mjs'))).toBe(false)
    expect(existsSync(join(rootDir, '.output/server'))).toBe(true)
    expect(existsSync(join(rootDir, '.output/public/_nuxt'))).toBe(true)
    expect(existsSync(join(rootDir, '.output/public/skip-me.txt'))).toBe(true)
  }, 60_000)
})

async function createFixture (config: { build: { client?: boolean, server?: boolean }, builder?: Builder, runtimeCompiler?: boolean }) {
  const rootDir = join(repoRoot, 'node_modules/.fixture', `build-options-${randomUUID()}`)
  const buildLog = join(rootDir, 'build.log')
  fixtureRoots.push(rootDir)

  await mkdir(join(rootDir, 'server/api'), { recursive: true })
  await mkdir(join(rootDir, 'public'), { recursive: true })

  await writeFile(join(rootDir, 'app.vue'), '<template><div>Build options fixture</div></template>\n')
  await writeFile(join(rootDir, 'server/api/ping.get.ts'), 'export default defineEventHandler(() => "pong")\n')
  await writeFile(join(rootDir, 'public/skip-me.txt'), 'this should not be copied by server-only builds\n')
  await writeFile(join(rootDir, 'package.json'), JSON.stringify({ type: 'module', dependencies: { nuxt: 'workspace:*' } }))
  await writeFile(join(rootDir, 'nuxt.config.ts'), `
import { appendFileSync } from 'node:fs'

export default defineNuxtConfig({
  builder: ${JSON.stringify(config.builder || 'vite')},
  build: ${JSON.stringify(config.build)},
  compatibilityDate: 'latest',
  devtools: { enabled: false },
  experimental: {
    appManifest: false,
  },
  hooks: {
    'vite:extendConfig' (_config, env) {
      appendFileSync(${JSON.stringify(buildLog)}, env.isClient ? 'client\\n' : 'server\\n')
    },
    'webpack:config' (configs) {
      appendFileSync(${JSON.stringify(buildLog)}, configs.map(config => config.name).join(',') + '\\n')
    },
    'rspack:config' (configs) {
      appendFileSync(${JSON.stringify(buildLog)}, configs.map(config => config.name).join(',') + '\\n')
    },
  },
  typescript: {
    typeCheck: false,
  },
  vue: {
    runtimeCompiler: ${JSON.stringify(config.runtimeCompiler || false)},
  },
})
`)

  return { rootDir, buildLog }
}

async function buildFixture (rootDir: string) {
  const nuxt = await loadNuxt({
    cwd: rootDir,
    overrides: {
      dev: false,
      test: true,
    },
    ready: true,
  })

  await build(nuxt)
}
