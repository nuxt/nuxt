import { mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { join, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import type { NuxtApp } from 'nuxt/schema'
import { createApp } from '../src/core/app.ts'
import { loadNuxt } from '../src/index.ts'

const repoRoot = await findWorkspaceDir()

const page = (name: string) => `<script setup>definePageMeta({ name: '${name}' })</script><template><div /></template>`
const pageNames = (app: NuxtApp) => app.pages?.flatMap(p => p.name ? [p.name] : []).sort()

interface PagesFixture {
  app: NuxtApp
  pagesDir: string
  layerPagesDir: string
  watch: (event: 'add' | 'change' | 'unlink', file: string) => unknown
}

async function withPagesFixture (pages: Record<string, string>, run: (ctx: PagesFixture) => Promise<void>, layerPages: Record<string, string> = {}) {
  const rootDir = resolve(repoRoot, 'node_modules/.fixture', randomUUID())
  const pagesDir = join(rootDir, 'app/pages')
  const layerPagesDir = join(rootDir, 'layer/app/pages')
  await mkdir(pagesDir, { recursive: true })
  await mkdir(layerPagesDir, { recursive: true })
  await writeFile(join(rootDir, 'nuxt.config.ts'), `export default { extends: ['./layer'] }`)
  await writeFile(join(rootDir, 'layer/nuxt.config.ts'), 'export default {}')
  for (const [file, name] of Object.entries(pages)) {
    await writeFile(join(pagesDir, file), page(name))
  }
  for (const [file, name] of Object.entries(layerPages)) {
    await writeFile(join(layerPagesDir, file), page(name))
  }

  const nuxt = await loadNuxt({ cwd: rootDir, overrides: { dev: true } })
  try {
    const app = nuxt.apps.default = createApp(nuxt)
    await nuxt.callHook('app:templates', app)
    expect(pageNames(app)).toEqual(Object.values({ ...layerPages, ...pages }).sort())
    await run({ app, pagesDir, layerPagesDir, watch: (event, file) => nuxt.callHook('builder:watch', event, file) })
  } finally {
    await nuxt.close()
    await rm(rootDir, { recursive: true, force: true })
  }
}

describe('pages watcher', () => {
  it('re-reads a changed page without rescanning the pages directories', async () => {
    await withPagesFixture({ 'index.vue': 'before' }, async ({ app, pagesDir, watch }) => {
      await writeFile(join(pagesDir, 'index.vue'), page('after'))
      await writeFile(join(pagesDir, 'unwatched.vue'), page('unwatched'))
      await watch('change', join(pagesDir, 'index.vue'))

      expect(pageNames(app)).toEqual(['after'])
    })
  })

  it('removes a deleted page without rescanning the pages directories', async () => {
    await withPagesFixture({ 'index.vue': 'index', 'about.vue': 'about' }, async ({ app, pagesDir, watch }) => {
      await unlink(join(pagesDir, 'about.vue'))
      await writeFile(join(pagesDir, 'unwatched.vue'), page('unwatched'))
      await watch('unlink', join(pagesDir, 'about.vue'))

      expect(pageNames(app)).toEqual(['index'])
    })
  })

  it('restores a layer page when the page overriding it is deleted', async () => {
    await withPagesFixture({ 'about.vue': 'app-about' }, async ({ app, pagesDir, watch }) => {
      await unlink(join(pagesDir, 'about.vue'))
      await watch('unlink', join(pagesDir, 'about.vue'))

      expect(pageNames(app)).toEqual(['layer-about'])
    }, { 'about.vue': 'layer-about' })
  })

  it('restores a layer page added while overridden when the override is deleted', async () => {
    await withPagesFixture({ 'about.vue': 'app-about' }, async ({ app, pagesDir, layerPagesDir, watch }) => {
      await writeFile(join(layerPagesDir, 'about.vue'), page('layer-about'))
      await watch('add', join(layerPagesDir, 'about.vue'))
      expect(pageNames(app)).toEqual(['app-about'])

      await unlink(join(pagesDir, 'about.vue'))
      await watch('unlink', join(pagesDir, 'about.vue'))

      expect(pageNames(app)).toEqual(['layer-about'])
    })
  })

  it('does not restore an overridden layer page that was deleted', async () => {
    await withPagesFixture({ 'index.vue': 'index', 'about.vue': 'app-about' }, async ({ app, pagesDir, layerPagesDir, watch }) => {
      await unlink(join(layerPagesDir, 'about.vue'))
      await watch('unlink', join(layerPagesDir, 'about.vue'))
      await unlink(join(pagesDir, 'about.vue'))
      await watch('unlink', join(pagesDir, 'about.vue'))

      expect(pageNames(app)).toEqual(['index'])
    }, { 'about.vue': 'layer-about' })
  })
})
