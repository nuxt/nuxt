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

async function withPagesFixture (pages: Record<string, string>, run: (ctx: { app: NuxtApp, pagesDir: string, watch: (event: 'change' | 'unlink', file: string) => unknown }) => Promise<void>) {
  const rootDir = resolve(repoRoot, 'node_modules/.fixture', randomUUID())
  const pagesDir = join(rootDir, 'app/pages')
  await mkdir(pagesDir, { recursive: true })
  await writeFile(join(rootDir, 'nuxt.config.ts'), 'export default {}')
  for (const [file, name] of Object.entries(pages)) {
    await writeFile(join(pagesDir, file), page(name))
  }

  const nuxt = await loadNuxt({ cwd: rootDir, overrides: { dev: true } })
  try {
    const app = nuxt.apps.default = createApp(nuxt)
    await nuxt.callHook('app:templates', app)
    expect(pageNames(app)).toEqual(Object.values(pages).sort())
    await run({ app, pagesDir, watch: (event, file) => nuxt.callHook('builder:watch', event, `pages/${file}`) })
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
      await watch('change', 'index.vue')

      expect(pageNames(app)).toEqual(['after'])
    })
  })

  it('removes a deleted page without rescanning the pages directories', async () => {
    await withPagesFixture({ 'index.vue': 'index', 'about.vue': 'about' }, async ({ app, pagesDir, watch }) => {
      await unlink(join(pagesDir, 'about.vue'))
      await writeFile(join(pagesDir, 'unwatched.vue'), page('unwatched'))
      await watch('unlink', 'about.vue')

      expect(pageNames(app)).toEqual(['index'])
    })
  })
})
