import { mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { join, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import type { Nuxt, NuxtTemplate } from 'nuxt/schema'
import { createApp, generateApp } from '../src/core/app.ts'
import { loadNuxt } from '../src/index.ts'
import { logger } from '../src/utils.ts'

const repoRoot = await findWorkspaceDir()

let clock = 0
const SLOW_MS = 600

const filenames = ['fast-a.mjs', 'fast-b.mjs', 'slow.mjs', 'fast-c.mjs']
const templates: NuxtTemplate[] = filenames.map(filename => filename === 'slow.mjs'
  ? {
      filename,
      async getContents () {
        await Promise.resolve()
        clock += SLOW_MS
        return 'export default "slow"'
      },
    }
  : { filename, getContents: () => `export default ${JSON.stringify(filename)}` })

describe('generateApp compile time', () => {
  const rootDir = resolve(repoRoot, 'node_modules/.fixture', randomUUID())
  let nuxt: Nuxt

  beforeAll(async () => {
    await mkdir(rootDir, { recursive: true })
    await writeFile(join(rootDir, 'nuxt.config.ts'), 'export default {}')
    nuxt = await loadNuxt({ cwd: rootDir })
    nuxt.hook('app:templates', (app) => { app.templates.push(...templates) })
  })

  afterAll(async () => {
    await nuxt.close()
    await rm(rootDir, { recursive: true, force: true })
  })

  async function generate (debugTemplates: boolean) {
    nuxt.options.debug = (debugTemplates ? { templates: true } : false) as Nuxt['options']['debug']
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {})
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock)
    try {
      await generateApp(nuxt, createApp(nuxt), { filter: t => filenames.includes(t.filename) })
      return info.mock.calls.map(call => String(call[0]))
    } finally {
      now.mockRestore()
      info.mockRestore()
    }
  }

  it('reports slow template generation in a single line', async () => {
    const messages = await generate(false)
    expect(messages).toStrictEqual([expect.stringContaining(`Generating templates took ${SLOW_MS}ms`)])
  })

  it('reports only the slow template as slow when debugging templates', async () => {
    const messages = await generate(true)
    expect(messages.filter(m => m.startsWith('Compiled'))).toStrictEqual([
      'Compiled `#build/fast-a.mjs` in 0ms',
      'Compiled `#build/fast-b.mjs` in 0ms',
      `Compiled \`#build/slow.mjs\` in ${SLOW_MS}ms`,
      'Compiled `#build/fast-c.mjs` in 0ms',
    ])
  })
})
