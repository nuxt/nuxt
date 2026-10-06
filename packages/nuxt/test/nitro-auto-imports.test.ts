import { describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import type { NuxtConfig } from '@nuxt/schema'
import { loadNuxt } from '../src/index.ts'

const repoRoot = await findWorkspaceDir()

describe('nitro auto-imports', () => {
  it('auto-imports h3 and nitro helpers by default', async () => {
    const names = await getServerImportNames('basic')
    expect(names).toContain('defineEventHandler')
    expect(names).toContain('useStorage')
  })

  it('keeps nuxt server imports but drops h3 and nitro helpers when opted out (#34142)', async () => {
    const names = await getServerImportNames('minimal', { experimental: { nitroAutoImports: false } })
    expect(names).toContain('defineAppConfig')
    expect(names).not.toContain('defineEventHandler')
    expect(names).not.toContain('useStorage')
  })

  it('does not bring back h3 and nitro helpers when a module adds server imports', async () => {
    // the `basic` fixture registers a module that calls `addServerImports`
    const names = await getServerImportNames('basic', { experimental: { nitroAutoImports: false } })
    expect(names).not.toContain('defineEventHandler')
    expect(names).not.toContain('useStorage')
  })
})

async function getServerImportNames (fixture: string, overrides: NuxtConfig = {}) {
  const names: string[] = []
  const nuxt = await loadNuxt({
    cwd: join(repoRoot, 'test/fixtures', fixture),
    ready: true,
    overrides: {
      ...overrides,
      hooks: {
        async 'nitro:init' (nitro) {
          for (const i of await nitro.unimport?.getImports() || []) {
            names.push(i.as || i.name)
          }
        },
      },
    },
  })
  await nuxt.close()
  return names
}
