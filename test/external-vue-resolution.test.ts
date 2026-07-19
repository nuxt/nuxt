import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { runsOnceInMatrix } from './matrix'

describe.skipIf(!runsOnceInMatrix)('SSR vite resolve conditions', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/external-vue-resolution', import.meta.url))

  it('resolves `vue` and `vue-router` from nuxt runtime files', async () => {
    const result = await exec('pnpm', ['nuxt', 'build', rootDir], { throwOnError: false })
    expect(result.exitCode, result.stderr || result.stdout).toBe(0)
  }, 120 * 1000)
})
