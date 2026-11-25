import { describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import type { NuxtConfig } from '@nuxt/schema'

import { loadNuxt } from '../src/index.ts'

const repoRoot = await findWorkspaceDir()

async function loadOptions (overrides?: NuxtConfig) {
  const nuxt = await loadNuxt({ cwd: join(repoRoot, 'test/fixtures/minimal'), ready: false, overrides })
  await nuxt.close()
  return nuxt.options
}

describe('server templates', () => {
  it('should share server templates with the virtual modules of the Nitro config', async () => {
    const options = await loadOptions()

    expect(options._serverTemplates).toEqual({})
    expect(options.nitro.virtual).toBe(options._serverTemplates)

    options._serverTemplates['#template'] = 'export {}'
    expect(options.nitro.virtual).toEqual({ '#template': 'export {}' })

    options.nitro.virtual = { ...options.nitro.virtual, '#virtual': 'export {}' }
    expect(options._serverTemplates).toEqual({ '#template': 'export {}', '#virtual': 'export {}' })
  })

  it('should include virtual modules configured for Nitro', async () => {
    const fromConfig = () => ''
    const options = await loadOptions({ nitro: { virtual: { '#from-config': fromConfig } } })

    expect(options._serverTemplates).toEqual({ '#from-config': fromConfig })
    expect(options.nitro.virtual).toBe(options._serverTemplates)
  })
})
