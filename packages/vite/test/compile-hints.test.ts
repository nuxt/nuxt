import { readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NuxtConfig } from '@nuxt/schema'
import { join } from 'pathe'

import { buildFixture, writeFiles } from './utils.ts'

const tmpDir = fileURLToPath(new URL('./.tmp/compile-hints', import.meta.url))
const COMPILE_HINT = '//# allFunctionsCalledOnLoad'

interface ManifestChunk {
  file: string
  isEntry?: boolean
  imports?: string[]
}

async function build (overrides: NuxtConfig) {
  await rm(join(tmpDir, '.output'), { recursive: true, force: true })
  await buildFixture(tmpDir, overrides)

  const publicDir = join(tmpDir, '.output/public')
  const manifest: Record<string, ManifestChunk> = JSON.parse(await readFile(join(publicDir, 'manifest.json'), 'utf8'))
  const read = (key: string) => readFile(join(publicDir, manifest[key]!.file), 'utf8')
  const readMap = async (key: string) => JSON.parse(await readFile(join(publicDir, manifest[key]!.file + '.map'), 'utf8'))
  const find = (suffix: string) => Object.keys(manifest).find(key => key.endsWith(suffix))!
  const entry = Object.keys(manifest).find(key => manifest[key]!.isEntry)!
  return { manifest, entry, read, readMap, find }
}

function firstMappedLine (mappings: string) {
  return mappings.split(';').findIndex(Boolean)
}

function firstCodeLine (code: string) {
  return code.split('\n').findIndex(line => !line.startsWith('//#') && !line.startsWith('const __vite__mapDeps'))
}

describe('compile hints', () => {
  beforeAll(async () => {
    const page = (name: string) => [
      '<script setup>',
      'import Shared from \'~/components/Shared.vue\'',
      'const Lazy = defineAsyncComponent(() => import(\'~/components/Lazy.vue\'))',
      '</script>',
      '',
      `<template><div>${name}<Shared /><Lazy /></div></template>`,
    ].join('\n')
    await writeFiles(tmpDir, {
      'app/app.vue': '<template><NuxtLayout><NuxtPage /></NuxtLayout></template>',
      'app/layouts/default.vue': '<template><main><slot /></main></template>',
      'app/utils/shout.ts': 'export const shout = (text: string) => text.toUpperCase()',
      'app/components/Shared.vue': '<script setup>\nimport { shout } from \'~/utils/shout\'\n</script>\n\n<template><p>{{ shout(\'shared\') }}</p></template>',
      'app/components/Lazy.vue': '<template><p>lazy</p></template>',
      'extra/page.vue': '<template><p>extra</p></template>',
      'app/pages/index.vue': page('index'),
      'app/pages/about.vue': page('about'),
    })
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('prepends a compile hint to the entry, layouts, pages and their static imports', async () => {
    const { manifest, entry, read, readMap, find } = await build({
      sourcemap: { client: true },
      hooks: {
        'pages:extend' (pages) {
          pages.push({ path: '/extra', file: join(tmpDir, 'extra/page.vue') })
        },
      },
    })

    const shared = manifest[find('pages/index.vue')]!.imports!.filter(key => key.startsWith('_'))
    expect(shared.length).toBeGreaterThan(0)

    for (const key of [entry, find('pages/index.vue'), find('pages/about.vue'), find('layouts/default.vue'), find('extra/page.vue'), ...shared]) {
      expect.soft((await read(key)).split('\n')[0], key).toBe(COMPILE_HINT)
    }
    for (const key of [find('components/Lazy.vue'), find('error-404.vue')]) {
      expect.soft(await read(key), key).not.toContain(COMPILE_HINT)
    }
    for (const key of [entry, ...shared]) {
      const { mappings } = await readMap(key)
      expect.soft(firstMappedLine(mappings), key).toBe(firstCodeLine(await read(key)))
    }
  }, 240 * 1000)

  it('changes the filename of chunks whose compile hint is toggled', async () => {
    const snapshot = async (compileHints: boolean) => {
      const { manifest, read } = await build({ experimental: { compileHints } })
      const files: Record<string, string> = {}
      for (const key in manifest) {
        files[manifest[key]!.file] = await read(key)
      }
      return files
    }

    const hinted = await snapshot(true)
    const plain = await snapshot(false)

    const shared = Object.keys(hinted).filter(file => file in plain)
    expect(shared.length).toBeGreaterThan(0)
    expect(shared.length).toBeLessThan(Object.keys(hinted).length)
    for (const file of shared) {
      expect.soft(hinted[file], file).toBe(plain[file])
    }
  }, 240 * 1000)

  it('shifts inline sourcemaps by one line', async () => {
    const { entry, read } = await build({ sourcemap: { client: true }, vite: { build: { sourcemap: 'inline' } } })

    const code = await read(entry)
    expect(code.split('\n')[0]).toBe(COMPILE_HINT)
    const inlineMaps = [...code.matchAll(/\/\/# sourceMappingURL=data:application\/json[^,]*;base64,(\S+)/g)]
    expect(inlineMaps).toHaveLength(1)
    const { mappings } = JSON.parse(Buffer.from(inlineMaps[0]![1]!, 'base64').toString())
    expect(firstMappedLine(mappings)).toBe(firstCodeLine(code))
  }, 240 * 1000)
})
