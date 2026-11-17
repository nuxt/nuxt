import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { buildNuxt } from '@nuxt/kit'
import type { InlinePreset } from 'unimport'
import { loadNuxt } from '../src/index.ts'
import { appCompatPresets, defaultPresets } from '../src/imports/presets.ts'
import { ERROR_CHANNEL_BROADCAST } from '../src/runtime/server/dev-error/index.ts'
import type { ErrorChannelMessage } from '../src/runtime/server/dev-error/index.ts'

const fixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./imports-preset-fixture', import.meta.url))))

let warn: MockInstance<typeof console.warn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

async function loadFixtureNuxt (overrides: Record<string, any> = {}) {
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: false,
    overrides: {
      ...overrides,
      builder: {
        bundle: () => {
          nuxt.hooks.removeAllHooks()
          return Promise.resolve()
        },
      },
    },
  })
  return nuxt
}

describe('imports preset resolution', () => {
  it('preserves non-JSON values when cloning configured presets', async () => {
    const nuxt = await loadFixtureNuxt({
      imports: {
        presets: [
          { package: 'defu', ignore: [/^createDefu$/] },
        ],
      },
    })

    let names: string[] = []
    nuxt.hook('imports:context', async (ctx) => {
      names = (await ctx.getImports()).map(i => i.as || i.name)
    })

    await nuxt.ready()
    await buildNuxt(nuxt)
    await nuxt.close()

    expect(names).toContain('defu')
    expect(names).not.toContain('createDefu')
  })

  it('does not leak module additions back into configured presets', async () => {
    const nuxt = await loadFixtureNuxt()

    const configuredPresets = nuxt.options.imports.presets!
    const configuredLength = configuredPresets.length
    const firstPreset = configuredPresets[0] as InlinePreset
    const firstPresetImports = [...firstPreset.imports]

    nuxt.hook('imports:sources', (presets) => {
      presets.push({ from: 'some-module', imports: ['someUtil'] })
      ;(presets[0] as InlinePreset).imports.push('injectedByModule')
    })

    await nuxt.ready()
    await buildNuxt(nuxt)
    await nuxt.close()

    expect(nuxt.options.imports.presets).toHaveLength(configuredLength)
    expect(firstPreset.imports).toEqual(firstPresetImports)
  })

  it('does not leak module additions into the presets shared between invocations', async () => {
    const ownPresets = [...defaultPresets, ...appCompatPresets]
    const ownSources = new Set(ownPresets.map(preset => preset.from))
    const snapshot = JSON.stringify(ownPresets)

    for (let invocation = 0; invocation < 2; invocation++) {
      const nuxt = await loadFixtureNuxt()

      nuxt.hook('imports:sources', (presets) => {
        for (const preset of presets as InlinePreset[]) {
          if (ownSources.has(preset.from)) {
            preset.imports.push(`injectedByInvocation${invocation}`)
          }
        }
      })

      let names: string[] = []
      nuxt.hook('imports:context', async (ctx) => {
        names = (await ctx.getImports()).map(i => i.as || i.name)
      })

      await nuxt.ready()
      await buildNuxt(nuxt)
      await nuxt.close()

      expect(names).toContain(`injectedByInvocation${invocation}`)
      if (invocation > 0) {
        expect(names).not.toContain(`injectedByInvocation${invocation - 1}`)
      }
      expect(JSON.stringify(ownPresets)).toBe(snapshot)
    }
  })

  it('warns when a preset `from` cannot be resolved', async () => {
    const nuxt = await loadFixtureNuxt()

    await nuxt.ready()
    await buildNuxt(nuxt)
    await nuxt.close()

    const messages = warn.mock.calls.map(call => call.join(' '))
    expect(messages.some(message => message.includes('NUXT_B6005') && message.includes('nuxt/dist/composables/router'))).toBe(true)
    expect(messages.some(message => message.includes('NUXT_B6005') && message.includes('utils/missing'))).toBe(true)
    expect(messages.some(message => message.includes('utils/existing'))).toBe(false)
  })

  it('warns once about an import overriding a built-in', async () => {
    const nuxt = await loadFixtureNuxt({
      hooks: {
        'imports:extend': (imports: Array<{ name: string, from: string }>) => {
          imports.push({ name: 'useRoute', from: 'custom-router' })
        },
      },
    })

    await nuxt.ready()
    await buildNuxt(nuxt)
    await nuxt.close()

    const messages = warn.mock.calls.map(call => call.join(' '))
    expect(messages.filter(message => message.includes('NUXT_B6002'))).toHaveLength(1)
  })

  it('warns once about a duplicated import, publishing it as a problem in development', async () => {
    const published: ErrorChannelMessage[] = []
    const listener = new BroadcastChannel(ERROR_CHANNEL_BROADCAST)
    listener.onmessage = event => published.push((event as MessageEvent<ErrorChannelMessage>).data)
    onTestFinished(() => listener.close())
    const dir = await mkdtemp(join(fixtureDir, '.duplicated-'))
    onTestFinished(() => rm(dir, { recursive: true, force: true }))
    const file = join(dir, 'duplicated.ts')
    await writeFile(file, 'export const other = 1\nexport const duplicated = 2\n')

    const nuxt = await loadFixtureNuxt({
      dev: true,
      hooks: {
        'imports:extend': (imports: Array<{ name: string, from: string }>) => {
          imports.push({ name: 'duplicated', from: file }, { name: 'duplicated', from: 'some-package' })
        },
      },
    })

    await nuxt.ready()
    await buildNuxt(nuxt)
    const isImportProblems = (message: ErrorChannelMessage) => message.type === 'nuxt:dev:error:problems' && message.source === 'nuxt:imports'
    await vi.waitFor(() => expect(published.some(isImportProblems)).toBe(true))
    await nuxt.close()

    const messages = warn.mock.calls.map(call => call.join(' '))
    expect(messages.filter(message => message.includes('Duplicated imports "duplicated"'))).toHaveLength(1)

    const problems = published.find(isImportProblems) as Extract<ErrorChannelMessage, { type: 'nuxt:dev:error:problems' }> | undefined
    expect(problems).toMatchObject({ meta: { group: 'Nuxt', label: 'Imports' } })
    expect(problems?.reports).toMatchObject([{
      kind: 'warning',
      name: 'Imports',
      message: expect.stringMatching(/^Duplicated imports "duplicated", the one from "~~\/\.duplicated-\w+\/duplicated\.ts" has been ignored and "some-package" is used$/),
      frames: [{ file, line: 2, column: 14 }],
    }])
  })
})
