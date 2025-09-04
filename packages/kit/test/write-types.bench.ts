import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, bench, describe } from 'vitest'
import { join, resolve } from 'pathe'
import type { Nuxt } from 'nuxt/schema'
import { loadNuxt, writeTypes } from '@nuxt/kit'
import { findWorkspaceDir } from 'pkg-types'

describe('writeTypes', async () => {
  const repoRoot = await findWorkspaceDir()
  const path = join(repoRoot, 'test/fixtures/basic-types')

  let nuxt: Nuxt

  beforeAll(async () => {
    nuxt = await loadNuxt({ cwd: path })
    await rm(resolve(path, '.nuxt'), { recursive: true, force: true })
  }, 20_000)

  afterAll(async () => {
    await nuxt.close()
  }, 20_000)

  bench('writeTypes in the basic-types fixture', async () => {
    await writeTypes(nuxt)
  })
})
