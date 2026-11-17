import { fileURLToPath } from 'node:url'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt, runWithNuxtContext } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import { getTranspilePatterns, getTranspileStrings } from '../src/utils/transpile.ts'

const fixtureDir = fileURLToPath(new URL('../../../test/fixtures-temp/transpile-test', import.meta.url))

describe('transpile patterns', () => {
  it('should resolve strings, regular expressions and functions, skipping falsy function results', () => {
    const nuxt = { options: { build: { transpile: ['alpha', /beta/, ({ isServer }: { isServer?: boolean }) => isServer && 'gamma', () => '', () => false] } } } as unknown as Nuxt

    runWithNuxtContext(nuxt, () => {
      expect(getTranspilePatterns({ isDev: false, isServer: true })).toEqual([/alpha/, /beta/, /gamma/])
      expect(getTranspilePatterns({ isDev: false, isClient: true })).toEqual([/alpha/, /beta/])
      expect(getTranspileStrings({ isDev: false, isServer: true })).toEqual(['alpha', 'gamma'])
    })
  })
})

// https://github.com/nuxt/nuxt/issues/33828
describe('async transpile to optimizeDeps.exclude', () => {
  let capturedExclude: string[] = []

  beforeAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
    await mkdir(join(fixtureDir, 'app'), { recursive: true })
    await writeFile(join(fixtureDir, 'app/app.vue'), '<template><div/></template>')
    await writeFile(join(fixtureDir, 'nuxt.config.ts'), `
export default defineNuxtConfig({
  modules: [
    (_, nuxt) => {
      nuxt.options.build.transpile.push('my-async-package')
    },
  ],
})
`)
  }, 30000)

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('includes async transpile entry in optimizeDeps.exclude', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      dev: true,
    })

    nuxt.hook('vite:configResolved', (config, { isClient }) => {
      if (isClient) {
        capturedExclude = config.environments?.client?.optimizeDeps?.exclude || config.optimizeDeps?.exclude || []
      }
    })

    await buildNuxt(nuxt)
    await nuxt.close()

    expect(capturedExclude).toContain('my-async-package')
  }, 60000)
})
