import { fileURLToPath } from 'node:url'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { x } from 'tinyexec'

import { loadNuxt } from '../src'

const repoRoot = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../', import.meta.url))))

describe('loadNuxt', () => {
  const tempDir = join(repoRoot, 'temp')

  beforeAll(async () => {
    await mkdir(join(tempDir, 'nuxt'), { recursive: true })
    await writeFile(join(tempDir, 'package.json'), '{"dependencies":{"nuxt":"file:./nuxt"}}')
    await writeFile(join(tempDir, 'nuxt', 'package.json'), '{"name":"nuxt","type":"module","exports":{".":"./index.js"}}')
    await writeFile(join(tempDir, 'nuxt', 'index.js'), 'export const loadNuxt = (opts) => ({ name: "it me" })')
    await x('npm', ['install'], { nodeOptions: { cwd: tempDir } })
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('respects correct directory', async () => {
    const nuxt = await loadNuxt({ cwd: tempDir })
    expect(nuxt).toStrictEqual({
      name: 'it me',
    })
  })
})
