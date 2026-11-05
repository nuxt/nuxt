import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { NuxtConfig } from '@nuxt/schema'
import { dirname, join } from 'pathe'
import type { Plugin, Rollup } from 'vite'

const tmpDir = fileURLToPath(new URL('./.tmp/client-chunks', import.meta.url))

async function build (files: Record<string, string>, overrides: NuxtConfig = {}) {
  await rm(tmpDir, { recursive: true, force: true })
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(tmpDir, path)), { recursive: true })
    await writeFile(join(tmpDir, path), contents)
  }

  const chunks: Record<string, Pick<Rollup.OutputChunk, 'name' | 'isEntry' | 'facadeModuleId' | 'imports' | 'moduleIds'>> = {}
  const capture: Plugin = {
    name: 'capture-client-chunks',
    applyToEnvironment: environment => environment.name === 'client',
    generateBundle (_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk') {
          chunks[chunk.fileName] = chunk
        }
      }
    },
  }

  const nuxt = await loadNuxt({
    cwd: tmpDir,
    ready: true,
    dev: false,
    overrides: {
      compatibilityDate: 'latest',
      devtools: { enabled: false },
      ...overrides,
      vite: { ...overrides.vite, plugins: [capture] },
    },
  })
  try {
    await buildNuxt(nuxt)
  } finally {
    await nuxt.close()
  }

  return {
    chunks,
    chunkOf: (path: string) => Object.keys(chunks).find(file => chunks[file]!.moduleIds.some(id => id.includes(path))),
  }
}

const sfc = (components: string[], template: string, setup = '') => [
  '<script setup lang="ts">',
  ...components.map(name => `import ${name} from '../components/${name}.vue'`),
  setup,
  '</script>',
  `<template>${template}</template>`,
].join('\n')

const app = {
  'app/app.vue': '<template><NuxtLayout><NuxtPage /></NuxtLayout></template>',
  'app/layouts/default.vue': sfc(['AppHeader', 'AppFooter'], '<div><AppHeader /><slot /><AppFooter /></div>'),
  'app/components/AppHeader.vue': '<template><header>header</header></template>',
  'app/components/AppFooter.vue': '<template><footer>footer</footer></template>',
  'app/pages/index.vue': sfc(['AppHeader'], '<AppHeader />'),
  'app/pages/about.vue': sfc(['AppFooter'], '<AppFooter />', `definePageMeta({ title: 'About' })`),
}

describe('client chunks', () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('keeps the static graph of the entry in the entry chunk', async () => {
    const { chunks, chunkOf } = await build(app)

    const entry = Object.keys(chunks).find(file => chunks[file]!.isEntry)!
    expect(chunkOf('@vue/runtime-core')).toBe(entry)
    expect(chunks[entry]!.imports).toEqual([])
  }, 120 * 1000)

  it('does not merge the static graphs of several entries', async () => {
    const { chunkOf } = await build(app, {
      experimental: { componentIslands: { selectiveClient: true } },
    })

    expect(chunkOf('app/components/nuxt-loading-indicator')).toBeDefined()
    expect(chunkOf('app/components/nuxt-loading-indicator')).not.toBe(chunkOf('@vue/runtime-core'))
  }, 120 * 1000)

  it('leaves chunking to `manualChunks` when it is set', async () => {
    const { chunks, chunkOf } = await build(app, {
      vite: {
        build: {
          rollupOptions: {
            output: {
              manualChunks: id => id.includes('AppHeader') ? 'header' : undefined,
            },
          },
        },
      },
    })

    expect(chunks[chunkOf('app/components/AppHeader.vue')!]!.name).toBe('header')
  }, 120 * 1000)

  it('bundles the static graph of a single layout into one chunk', async () => {
    const { chunks, chunkOf } = await build(app)

    const header = chunkOf('app/components/AppHeader.vue')!
    const layout = chunks[chunkOf('app/layouts/default.vue')!]!
    expect(chunkOf('app/components/AppFooter.vue')).toBe(header)
    expect(layout.imports).toContain(header)
    expect(layout.facadeModuleId).toBe(join(tmpDir, 'app/layouts/default.vue'))
  }, 120 * 1000)

  it('does not bundle modules shared by several layouts into one of them', async () => {
    const { chunkOf } = await build({
      ...app,
      'app/layouts/other.vue': sfc(['AppHeader'], '<div><AppHeader /><slot /></div>'),
    })

    const files = [chunkOf('app/components/AppHeader.vue'), chunkOf('app/layouts/default.vue'), chunkOf('app/layouts/other.vue')]
    expect(files).not.toContain(undefined)
    expect(new Set(files).size).toBe(3)
  }, 120 * 1000)

  it('does not bundle the layout dependencies when `experimental.layoutChunk` is disabled', async () => {
    const { chunkOf } = await build(app, { experimental: { layoutChunk: false } })

    expect(chunkOf('app/components/AppHeader.vue')).toBeDefined()
    expect(chunkOf('app/components/AppHeader.vue')).not.toBe(chunkOf('app/components/AppFooter.vue'))
  }, 120 * 1000)
})
