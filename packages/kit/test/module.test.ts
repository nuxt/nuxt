import { fileURLToPath } from 'node:url'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { dirname, join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'

import { read as readRc, write as writeRc } from 'rc9'
import { installModule, loadNuxt } from '../src'

const repoRoot = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../', import.meta.url))))
const testModule = withoutTrailingSlash(normalize(fileURLToPath(new URL('./module-fixture/module', import.meta.url))))
const hooksLogFile = join(dirname(testModule), './hooks-logs')

async function getHooksLogs () {
  const logs = await readFile(hooksLogFile, { encoding: 'utf8' }).catch(_ => '')
  return logs.split('\n').slice(0, -1)
}

describe.sequential('installModule', () => {
  const tempDir = join(repoRoot, 'module-temp')

  beforeAll(async () => {
    await mkdir(join(tempDir, 'nuxt'), { recursive: true })
    await rm(hooksLogFile, { force: true })
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  afterEach(async () => {
    await rm(hooksLogFile, { force: true })
  })

  it('runs onInstall hook when a module is added', async () => {
    const nuxt = await loadNuxt({ cwd: tempDir })
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

    const nuxt = await loadNuxt({ cwd: tempDir })
    await installModule(testModule, {}, nuxt)

    expect(await getHooksLogs()).toEqual([])
  })

  it('runs onUpgrade hook when a module is upgraded', async () => {
    writeRc(
      { setups: { 'test-module': '0.1.0' } },
      { dir: tempDir, name: '.nuxtrc' },
    )

    const nuxt = await loadNuxt({ cwd: tempDir })
    await installModule(testModule, {}, nuxt)

    expect(await getHooksLogs()).toEqual(['upgrade'])
    const rc = readRc({ dir: tempDir, name: '.nuxtrc' })
    expect(rc.setups['test-module']).toBe('1.0.0')
  })
})
