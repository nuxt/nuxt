import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import type { NuxtConfig } from 'nuxt/schema'

import { copyFixture } from './fixture-copy'
import { runsOnceInMatrix } from './matrix'
import { buildInProcess } from './utils'

const builds: Array<[name: string, overrides: NuxtConfig]> = [
  ['bundled', {}],
  ['traced', { experimental: { nitroViteEnvironment: true }, nitro: { traceDeps: ['unhead'] } }],
]

describe.skipIf(!runsOnceInMatrix).for(builds)('server build with a second copy of unhead (%s)', ([name, overrides]) => {
  let server: { default: { fetch: (request: Request) => Promise<Response> } }

  beforeAll(async () => {
    const rootDir = fileURLToPath(copyFixture('unhead-duplicate', `unhead-duplicate-${name}`))
    await buildInProcess(rootDir, { ...overrides, nitro: { ...overrides.nitro, preset: 'standard' } })
    server = await import(pathToFileURL(join(rootDir, '.output/server/index.mjs')).href)
  }, 240 * 1000)

  it('resolves server imports of unhead to nuxt\'s copy', async () => {
    const response = await server.default.fetch(new Request('http://localhost/api/head-props'))
    expect(await response.text()).toBe(' data-source="unhead"')
  })
})
