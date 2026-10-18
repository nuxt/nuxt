import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { join } from 'pathe'
import { getRandomPort } from 'get-port-please'
import { describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { NuxtConfig } from 'nuxt/schema'

import { copyFixture } from './fixture-copy'
import { runsOnceInMatrix } from './matrix'

async function fetchFromBuild (outputDir: string, path: string) {
  const port = await getRandomPort('127.0.0.1')
  const server = spawn(process.execPath, [join(outputDir, 'server/index.mjs')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: 'ignore',
  })
  try {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`).catch(() => undefined)
      if (res) {
        return { status: res.status, body: await res.text() }
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`built server at ${outputDir} did not start`)
  } finally {
    server.kill()
  }
}

async function buildWithHookAsset (dest: string, overrides: NuxtConfig) {
  const rootDir = fileURLToPath(copyFixture('minimal', dest))
  const nuxt = await loadNuxt({
    cwd: rootDir,
    ready: true,
    overrides: {
      ...overrides,
      modules: [
        (_options, nuxt) => {
          nuxt.hook('nitro:build:public-assets', async (nitro) => {
            await writeFile(join(nitro.options.output.publicDir, 'hook-asset.txt'), 'written in nitro:build:public-assets')
          })
        },
      ],
    },
  })
  try {
    await buildNuxt(nuxt)
  } finally {
    await nuxt.close()
  }
  return join(rootDir, '.output')
}

describe.skipIf(!runsOnceInMatrix)('nitro:build:public-assets', () => {
  it.each([true, false])('serves files written in the hook with nitroViteEnvironment: %s', async (nitroViteEnvironment) => {
    const outputDir = await buildWithHookAsset(`public-assets-hook-${nitroViteEnvironment}`, {
      experimental: { nitroViteEnvironment },
    })

    const res = await fetchFromBuild(outputDir, '/hook-asset.txt')
    expect(res).toEqual({ status: 200, body: 'written in nitro:build:public-assets' })
  }, 240 * 1000)

  it('writes files from the hook in a static build with nitroViteEnvironment', async () => {
    const outputDir = await buildWithHookAsset('public-assets-hook-static', {
      experimental: { nitroViteEnvironment: true },
      nitro: { static: true },
    })

    expect(await readFile(join(outputDir, 'public/hook-asset.txt'), 'utf-8')).toBe('written in nitro:build:public-assets')
  }, 240 * 1000)
})
