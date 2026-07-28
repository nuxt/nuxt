import { writeFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'

import type { FSWatcher } from 'vite'
import type { ResolvedNuxtTemplate } from 'nuxt/schema'
import { join, relative, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { build, loadNuxt } from 'nuxt'

describe('builder:watch', { sequential: true }, async () => {
  const tmpDir = join(await findWorkspaceDir(), '.test/builder-watch')
  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(join(tmpDir, 'project/node_modules'), { recursive: true })
  })
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })
  const watcherStrategies = ['chokidar', 'chokidar-granular', 'parcel'] as const
  it.each(watcherStrategies)('should restart Nuxt when a file is added with %s strategy', async (watcher) => {
    const rootDir = join(tmpDir, 'project')
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        experimental: { watcher },
        dev: true,
        watch: ['test', join(rootDir, 'other'), resolve(rootDir, '../higher')],
      },
    })
    let restarts = 0
    const events: string[] = []

    nuxt.hook('restart', () => { restarts++ })
    nuxt.hook('builder:watch', (event, path) => {
      if (event === 'add') {
        events.push(relative(rootDir, path))
      }
    })

    await build(nuxt)

    const watchPromise = new Promise(resolve => nuxt.hooks.hookOnce('builder:watch', resolve))
    writeFileSync(resolve(rootDir, '../higher'), 'something')
    writeFileSync(join(rootDir, 'test'), 'something')
    writeFileSync(join(rootDir, 'other'), 'something')
    await watchPromise

    await nuxt.close()

    expect.soft(restarts).toBe(3)
    expect.soft(events.sort()).toStrictEqual([
      '../higher',
      'other',
      'test',
    ])
  })

  it('should only recompile templates that can be affected by a changed file', async () => {
    const rootDir = join(tmpDir, 'project')
    await mkdir(join(rootDir, 'app/pages'), { recursive: true })
    await mkdir(join(rootDir, 'app/components'), { recursive: true })
    await writeFile(join(rootDir, 'app/pages/index.vue'), '<template><div>index</div></template>')
    await writeFile(join(rootDir, 'app/components/Foo.vue'), '<template><div>foo</div></template>')

    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        dev: true,
        _prepare: true,
        experimental: { watcher: 'chokidar' },
      },
    })

    await build(nuxt)

    let generations = 0
    const selections: Array<string[] | undefined> = []
    nuxt.hook('app:templates', () => { generations++ })
    nuxt.hook('app:templatesGenerated', (app, _templates, options) => {
      selections.push(options?.filter ? app.templates.filter(t => options.filter!(t as ResolvedNuxtTemplate<any>)).map(t => t.filename!).sort() : undefined)
    })

    await nuxt.callHook('builder:watch', 'change', 'components/Foo.vue')
    expect.soft(generations).toBe(0)

    await nuxt.callHook('builder:watch', 'change', 'pages/index.vue')
    expect.soft(generations).toBe(1)
    expect.soft(selections.every(selection => selection?.includes('routes.mjs'))).toBe(true)

    await nuxt.close()
  })

  it('should restart Nuxt when a file is added with builder strategy', async () => {
    const rootDir = join(tmpDir, 'project')
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        experimental: { watcher: 'builder' },
        dev: true,
        watch: ['test', join(rootDir, 'other'), resolve(rootDir, '../higher')],
      },
    })
    const targets = new Set(['../higher', 'other', 'test'])
    const seenAdds = new Set<string>()
    let resolveAll: () => void
    const allSeen = new Promise<void>((resolve) => { resolveAll = resolve })

    nuxt.hook('builder:watch', (event, path) => {
      if (event !== 'add') { return }
      const rel = relative(rootDir, path)
      if (targets.has(rel) && !seenAdds.has(rel)) {
        seenAdds.add(rel)
        if (seenAdds.size === targets.size) { resolveAll() }
      }
    })

    let viteWatcher: FSWatcher | undefined
    nuxt.hook('vite:serverCreated', (server, { isClient }) => {
      if (isClient) {
        viteWatcher = server.watcher
      }
    })

    await build(nuxt)

    const watcher = viteWatcher!
    if (!(watcher as FSWatcher & { _readyEmitted?: boolean })._readyEmitted) {
      await new Promise<void>(r => watcher.once('ready', r))
    }

    writeFileSync(resolve(rootDir, '../higher'), 'something')
    writeFileSync(join(rootDir, 'test'), 'something')
    writeFileSync(join(rootDir, 'other'), 'something')
    await allSeen

    await nuxt.close()

    expect.soft([...seenAdds].sort()).toStrictEqual([
      '../higher',
      'other',
      'test',
    ])
  })
})
