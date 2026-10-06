import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'

import { runsOnceInMatrix } from './matrix'

if (runsOnceInMatrix) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/unhead-duplicate', import.meta.url)),
    dev: false,
    server: true,
    browser: false,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOnceInMatrix)('server bundle with a second copy of unhead', () => {
  it('traces nuxt\'s copy of unhead and resolves server imports to it', async () => {
    const unheadDir = join(useTestContext().nuxt!.options.nitro.output!.dir!, 'server/node_modules/unhead')
    expect(await readdir(join(unheadDir, 'dist'))).toContain('legacy.mjs')
    expect(JSON.parse(await readFile(join(unheadDir, 'package.json'), 'utf-8')).version).not.toBe('0.0.0-duplicate')
    expect(await $fetch<string>('/api/head-props')).toBe(' data-source="unhead"')
  })
})
