import { mkdir, readFile, rm } from 'node:fs/promises'
import { appendFileSync } from 'node:fs'

import type { Nuxt } from 'nuxt/schema'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { read as readRc, write as writeRc } from 'rc9'

import { defineNuxtModule, installModule, loadNuxt } from '../src'

const repoRoot = await findWorkspaceDir()

describe('installNuxtModule', { sequential: true }, () => {
  let nuxt: Nuxt

  const tempDir = join(repoRoot, 'node_modules/.temp/module-temp-hooks')
  const hooksLogFile = join(tempDir, 'hooks-logs')

  async function getHooksLogs () {
    const logs = await readFile(hooksLogFile, { encoding: 'utf8' }).catch(_ => '')
    return logs.split('\n').slice(0, -1)
  }

  const testModule = defineNuxtModule({
    meta: {
      name: 'test-module',
      version: '1.0.0',
    },

    onInstall () {
      appendFileSync(hooksLogFile, 'install\n')
    },

    onUpgrade () {
      appendFileSync(hooksLogFile, 'upgrade\n')
    },
  })

  beforeAll(async () => {
    await mkdir(join(tempDir, 'nuxt'), { recursive: true })
    await rm(hooksLogFile, { force: true })
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  afterEach(async () => {
    await nuxt?.close()
    await rm(hooksLogFile, { force: true })
  })

  it('runs onInstall hook when a module is added', async () => {
    nuxt = await loadNuxt({ cwd: tempDir })
    await installModule(testModule, {}, nuxt)

    expect(await getHooksLogs()).toEqual(['install'])
    const rc = readRc({ dir: tempDir, name: '.nuxtrc' })
    expect(rc.setups['test-module']).toBe('1.0.0')
  })

  it('runs onInstall only once', async () => {
    writeRc(
      { setups: { 'test-module': '1.0.0' } },
      { dir: tempDir, name: '.nuxtrc' },
    )

    nuxt = await loadNuxt({ cwd: tempDir })
    await installModule(testModule, {}, nuxt)

    expect(await getHooksLogs()).toEqual([])
  })

  it('runs onUpgrade hook when a module is upgraded', async () => {
    writeRc(
      { setups: { 'test-module': '0.1.0' } },
      { dir: tempDir, name: '.nuxtrc' },
    )

    nuxt = await loadNuxt({ cwd: tempDir })
    await installModule(testModule, {}, nuxt)

    expect(await getHooksLogs()).toEqual(['upgrade'])
    const rc = readRc({ dir: tempDir, name: '.nuxtrc' })
    expect(rc.setups['test-module']).toBe('1.0.0')
  })
})
