import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { join } from 'pathe'
import { isWindows } from 'std-env'
import { describe, expect, it } from 'vitest'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/server-auto-imports', import.meta.url)),
  dev: isDev,
  server: true,
  browser: false,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
})

describe.skipIf(!runsOncePerEnvInMatrix)('server auto-imports', () => {
  it('auto-imports helpers from `server/utils` and `shared/utils` at runtime', async () => {
    expect(await $fetch('/api/greeting')).toEqual({
      server: 'from server/utils',
      shared: 'from shared/utils',
    })
  })

  it('declares those helpers in generated nitro types', () => {
    const buildDir = useTestContext().nuxt!.options.buildDir
    const types = readFileSync(join(buildDir, 'types/nitro/nitro-imports.d.ts'), 'utf-8')
    expect(types).toContain('serverUtilsGreeting')
    expect(types).toContain('sharedUtilsGreeting')
  })
})
