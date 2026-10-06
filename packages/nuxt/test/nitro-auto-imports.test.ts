import { describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { addServerImports } from '@nuxt/kit'
import type { NuxtConfig } from '@nuxt/schema'
import { loadNuxt } from '../src/index.ts'

const repoRoot = await findWorkspaceDir()
const fixtureDir = join(repoRoot, 'test/fixtures/basic')

describe('nitro auto-imports', () => {
  it('auto-imports h3 and nitro helpers by default', async () => {
    const names = await getServerImportNames()
    expect(names).toContain('defineEventHandler')
    expect(names).toContain('useStorage')
  })

  it('drops h3 and nitro helpers when nitro auto-imports are opted out', async () => {
    const names = await getServerImportNames({ experimental: { nitroAutoImports: false } })
    expect(names).not.toContain('defineEventHandler')
    expect(names).not.toContain('useStorage')
    // Nuxt's own server imports stay available
    expect(names).toContain('defineAppConfig')
  })

  it('keeps h3 and nitro helpers out when a module adds server imports', async () => {
    const names = await getServerImportNames({
      experimental: { nitroAutoImports: false },
      modules: [
        () => {
          addServerImports({ name: 'useModuleHelper', from: join(fixtureDir, 'server/utils/module-helper') })
        },
      ],
    })
    expect(names).toContain('useModuleHelper')
    expect(names).not.toContain('defineEventHandler')
    expect(names).not.toContain('useStorage')
  })
})

async function getServerImportNames (overrides: NuxtConfig = {}) {
  const names: string[] = []
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
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
