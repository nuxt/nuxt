import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { hash } from 'ohash'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Nitro } from 'nitro/types'
import type { BuildEnvironment } from 'vite'
import { canReuseSsrBuild } from '../src/vite.ts'

describe('canReuseSsrBuild', () => {
  let buildDir: string
  let outDir: string
  const config = { root: '/', define: {}, resolve: {}, build: {} as { outDir: string } }
  const nitro = { options: { virtual: {} } } as unknown as Nitro

  beforeEach(async () => {
    buildDir = await mkdtemp(join(tmpdir(), 'nitro-ssr-reuse-'))
    outDir = join(buildDir, 'vite/services/ssr')
    await mkdir(outDir, { recursive: true })
    config.build = { outDir }
    nitro.options.buildDir = buildDir
  })

  afterEach(async () => {
    await rm(buildDir, { recursive: true, force: true })
  })

  async function writeSsrOutput (entry: string) {
    const content = 'export default {}'
    await writeFile(join(outDir, entry), content)
    await writeFile(join(outDir, 'nuxt-ssr-inputs.json'), JSON.stringify({
      files: { [entry]: createHash('sha256').update(content).digest('base64url') },
      config: hash({ define: config.define, resolve: config.resolve, build: config.build }),
      virtuals: {},
    }))
  }

  it('should reuse an unchanged ssr build', async () => {
    await writeSsrOutput('index.mjs')
    expect(await canReuseSsrBuild(nitro, { config } as unknown as BuildEnvironment)).toBe(true)
  })

  it('should not reuse an ssr build without an `index.mjs` entry', async () => {
    await writeSsrOutput('entry.mjs')
    expect(await canReuseSsrBuild(nitro, { config } as unknown as BuildEnvironment)).toBe(false)
  })

  it('should not reuse an ssr build with unreadable inputs', async () => {
    await writeSsrOutput('index.mjs')
    await writeFile(join(outDir, 'nuxt-ssr-inputs.json'), '{')
    expect(await canReuseSsrBuild(nitro, { config } as unknown as BuildEnvironment)).toBe(false)
  })

  it('should not reuse an ssr build with incomplete inputs', async () => {
    await writeSsrOutput('index.mjs')
    await writeFile(join(outDir, 'nuxt-ssr-inputs.json'), JSON.stringify({
      config: hash({ define: config.define, resolve: config.resolve, build: config.build }),
    }))
    expect(await canReuseSsrBuild(nitro, { config } as unknown as BuildEnvironment)).toBe(false)
  })
})
