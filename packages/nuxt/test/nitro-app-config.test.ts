import { mkdir, rm, writeFile } from 'node:fs/promises'

import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { build, loadNuxt } from 'nuxt'
import type { NitroConfig } from 'nitro/types'

describe('nitro app config', { sequential: true, timeout: 120_000 }, async () => {
  const workspaceDir = await findWorkspaceDir()
  const tmpDir = join(workspaceDir, '.test/nitro-app-config')

  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(join(tmpDir, 'project/node_modules'), { recursive: true })
    await writeFile(join(tmpDir, 'project/app.vue'), '<template><div>hello</div></template>')
    await writeFile(join(tmpDir, 'project/app.config.ts'), 'export default defineAppConfig({ foo: \'bar\' })\n')
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  // Under compatibilityVersion 5 `nitroAutoImports` defaults to `false`, which previously dropped
  // every Nitro import — including the `defineAppConfig` shim — breaking servers that bundle `app.config.ts`.
  it('keeps `defineAppConfig` available to Nitro when auto-imports are disabled', async () => {
    const rootDir = join(tmpDir, 'project')

    let nitroImports: NitroConfig['imports']
    const nuxt = await loadNuxt({
      cwd: rootDir,
      overrides: {
        dev: false,
        workspaceDir: tmpDir,
        future: { compatibilityVersion: 5 },
        hooks: {
          'nitro:config' (nitroConfig) {
            nitroImports = nitroConfig.imports
          },
        },
      },
    })

    try {
      await build(nuxt)
    } finally {
      await nuxt.close()
    }

    // sanity check that we are exercising the disabled-auto-imports path
    expect(nuxt.options.experimental.nitroAutoImports).toBe(false)

    // the Nitro imports must remain enabled (not `false`) so the app-config shims are injected
    expect(nitroImports).not.toBe(false)
    const importNames = (typeof nitroImports === 'object' ? nitroImports.imports : undefined)?.map(i => i.as ?? i.name)
    // `useAppConfig` is restored alongside `defineAppConfig` because the `imports` object is now
    // truthy (it is pushed when `serverAppConfig` is enabled)
    expect(importNames).toContain('defineAppConfig')
    expect(importNames).toContain('useAppConfig')
  })
})
