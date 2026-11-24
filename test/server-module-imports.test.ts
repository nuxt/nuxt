import { mkdir, readdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { buildNuxt, loadNuxt, writeTypes } from '@nuxt/kit'

import { copyFixture } from './fixture-copy'
import { projectSuffix, runsOnceInMatrix, runsOncePerEnvInMatrix } from './matrix'
import { setupFixture } from './utils'

await setupFixture('server-module-imports', runsOncePerEnvInMatrix)

describe.skipIf(!runsOncePerEnvInMatrix)('server auto-imports registered by a module', () => {
  it('resolves a source only the module can resolve', async () => {
    expect(await $fetch('/api/module-dep')).toEqual({ injected: 'module-only-dep', barrel: 'module-only-dep' })
    expect(await $fetch('/api/module-legacy')).toEqual({ legacy: 'module-only-dep' })
  })

  it('renders the app', async () => {
    expect(await $fetch<string>('/')).toContain('server module imports')
  })
})

describe.skipIf(!runsOnceInMatrix)('server auto-imports in a build that clears the build directory after loading', () => {
  let server: { default: { fetch: (request: Request) => Promise<Response> } }

  beforeAll(async () => {
    const rootDir = fileURLToPath(copyFixture('server-module-imports', `server-module-imports-cleared-${projectSuffix}`))
    const nuxt = await loadNuxt({ cwd: rootDir, ready: true, overrides: { nitro: { preset: 'standard' } } })
    try {
      const kept = new Set(['cache', 'analyze', 'nuxt.json', 'nuxt.lock'])
      const entries = await readdir(nuxt.options.buildDir).catch(() => [])
      await Promise.all(entries.filter(name => !kept.has(name)).map(name => rm(join(nuxt.options.buildDir, name), { recursive: true, force: true })))
      await mkdir(nuxt.options.buildDir, { recursive: true })
      await writeTypes(nuxt)
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }
    server = await import(pathToFileURL(join(rootDir, '.output/server/index.mjs')).href)
  }, 240 * 1000)

  it('serves `#imports/server` and `#imports`', async () => {
    const [modern, legacy] = await Promise.all(['/api/module-dep', '/api/module-legacy'].map(path => server.default.fetch(new Request(`http://localhost${path}`)).then(r => r.json())))
    expect(modern).toEqual({ injected: 'module-only-dep', barrel: 'module-only-dep' })
    expect(legacy).toEqual({ legacy: 'module-only-dep' })
  })
})
