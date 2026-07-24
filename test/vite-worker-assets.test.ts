import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { setup, useTestContext } from '@nuxt/test-utils/e2e'

import { runsOnceInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/vite-worker-assets', import.meta.url))

if (runsOnceInMatrix) {
  await setup({
    rootDir,
    dev: false,
    build: true,
    server: false,
    browser: false,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOnceInMatrix)('Vite worker assets', () => {
  it('emits an asset shared with a worker only once', async () => {
    // @ts-expect-error ssssh! untyped secret property
    const publicDir = useTestContext().nuxt._nitro.options.output.publicDir
    const files = await readdir(join(publicDir, '_nuxt'))
    expect(files.filter(file => file.endsWith('.wasm'))).toHaveLength(1)
  })
})
