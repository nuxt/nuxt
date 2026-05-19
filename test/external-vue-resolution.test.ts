import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'

const nuxtEntry = fileURLToPath(new URL('../packages/nuxt/dist/index.mjs', import.meta.url))
const isStubbed = readFileSync(nuxtEntry, 'utf-8').includes('const _module = await jiti')

// only run once across the fixture matrix
const isMatrixRun = !!process.env.TEST_BUILDER
const skipForMatrix = isMatrixRun && !(
  process.env.TEST_BUILDER === 'vite'
  && process.env.TEST_ENV === 'built'
  && process.env.TEST_CONTEXT === 'default'
  && process.env.TEST_MANIFEST === 'manifest-on'
)

describe.skipIf(skipForMatrix)('SSR vite resolve conditions', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/external-vue-resolution', import.meta.url))

  it('resolves `vue` and `vue-router` from nuxt runtime files', async () => {
    const result = await exec('pnpm', ['nuxt', 'build', rootDir], { throwOnError: false })
    expect(result.exitCode, result.stderr || result.stdout).toBe(0)
  }, 120 * 1000)
})
