import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'

// only run once across the fixture matrix
const isMatrixRun = !!process.env.TEST_BUILDER
const skipForMatrix = isMatrixRun && !(
  process.env.TEST_BUILDER === 'vite'
  && process.env.TEST_ENV === 'built'
  && process.env.TEST_CONTEXT === 'default'
  && process.env.TEST_MANIFEST === 'manifest-on'
)

describe.skipIf(skipForMatrix)('nitro runtime resolution', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/nitro-runtime-resolution', import.meta.url))

  it('resolves `nitro` and `h3` imports from user server code', async () => {
    const result = await exec('pnpm', ['nuxt', 'build', rootDir], { throwOnError: false })
    expect(result.exitCode, result.stderr || result.stdout).toBe(0)
    expect(result.stdout + result.stderr).not.toContain('UNRESOLVED_IMPORT')
  }, 120 * 1000)
})
