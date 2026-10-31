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

const hooks = vi.hoisted(() => ({ enabled: 0 }))
vi.mock('node:async_hooks', async (importOriginal) => {
  const asyncHooks = await importOriginal<typeof import('node:async_hooks')>()
  return {
    ...asyncHooks,
    createHook: (callbacks: Parameters<typeof asyncHooks.createHook>[0]) => {
      const hook = asyncHooks.createHook(callbacks)
      return {
        enable () {
          hooks.enabled++
          hook.enable()
          return this
        },
        disable () {
          hooks.enabled--
          hook.disable()
          return this
        },
      }
    },
  }
})

const repoRoot = await findWorkspaceDir()

// A controlled clock: the slow template moves it forward 600ms after an `await`, the way a
// template blocks the event loop after awaiting something, and nothing else moves it.
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

  it('reports the whole generation once instead of a line for every template that waited', async () => {
    const messages = await generate(false)
    expect(messages.filter(m => m.startsWith('Compiled'))).toStrictEqual([])
    expect(messages).toStrictEqual([expect.stringContaining(`Generating templates took ${SLOW_MS}ms`)])
  })

  it('attributes a block after an `await` to the template that blocked when debugging templates', async () => {
    const messages = await generate(true)
    const compiled = messages.filter(m => m.startsWith('Compiled')).sort()
    expect(compiled).toStrictEqual([
      `Compiled \`#build/fast-a.mjs\` (0ms running, ${SLOW_MS}ms elapsed)`,
      `Compiled \`#build/fast-b.mjs\` (0ms running, ${SLOW_MS}ms elapsed)`,
      `Compiled \`#build/fast-c.mjs\` (0ms running, ${SLOW_MS}ms elapsed)`,
      `Compiled \`#build/slow.mjs\` (${SLOW_MS}ms running, ${SLOW_MS}ms elapsed)`,
    ])
  })

  it('turns activity tracking off after every generation', async () => {
    for (let i = 0; i < 3; i++) {
      await generate(true)
      expect(hooks.enabled).toBe(0)
    }
  })
})
