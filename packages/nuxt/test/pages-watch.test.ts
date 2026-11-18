import { mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { join, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { createApp } from '../src/core/app.ts'
import { loadNuxt } from '../src/index.ts'

const repoRoot = await findWorkspaceDir()

describe('pages watcher', () => {
  it('re-reads a changed page without rescanning the pages directories', async () => {
    const rootDir = resolve(repoRoot, 'node_modules/.fixture', randomUUID())
    const page = (name: string) => `<script setup>definePageMeta({ name: '${name}' })</script><template><div /></template>`
    await mkdir(join(rootDir, 'app/pages'), { recursive: true })
    await writeFile(join(rootDir, 'nuxt.config.ts'), 'export default {}')
    await writeFile(join(rootDir, 'app/pages/index.vue'), page('before'))

    const nuxt = await loadNuxt({ cwd: rootDir, overrides: { dev: true } })
    try {
      const app = nuxt.apps.default = createApp(nuxt)
      await nuxt.callHook('app:templates', app)
      expect(app.pages?.flatMap(p => p.name ? [p.name] : [])).toEqual(['before'])

      await writeFile(join(rootDir, 'app/pages/index.vue'), page('after'))
      await writeFile(join(rootDir, 'app/pages/unwatched.vue'), page('unwatched'))
      await nuxt.callHook('builder:watch', 'change', 'pages/index.vue')

      expect(app.pages?.flatMap(p => p.name ? [p.name] : [])).toEqual(['after'])
    } finally {
      await nuxt.close()
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
