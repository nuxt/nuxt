import { mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import type { Nuxt, RequestEvent } from 'nuxt/schema'
// loaded before the build directory is served, as in Nuxt: `app.ts` and `templates.ts` import each other
import '../src/core/app.ts'
import { createBuildDirHandler, handleBuildDirRequest } from '../src/core/dev-build-dir.ts'

const repoRoot = await findWorkspaceDir()
const rootDir = resolve(repoRoot, 'node_modules/.fixture', randomUUID())
const buildDir = join(rootDir, '.nuxt')

function createFakeNuxt () {
  return {
    _version: '5.0.0',
    options: { rootDir, buildDir, devServer: { url: 'http://localhost:3000/' } },
    vfs: {
      [join(buildDir, 'routes.mjs')]: 'export default []',
      '#build/routes.mjs': 'export default []',
      '#build/content/manifest.mjs': 'export const manifest = {}',
      '#build/layouts.mjs': 'export default {}',
      '/project/virtual-plugin.mjs': 'export default () => {}',
    },
    apps: {
      default: {
        templates: [
          { filename: 'content/manifest.mjs', _path: '/project/node_modules/@nuxt/content/dist/module.mjs' },
          // a built-in template, which has no `_path`
          { filename: 'layouts.mjs' },
        ],
      },
    },
    _vfsSources: [{
      keys: () => ['#nitro/virtual/app'],
      read: (id: string) => id === '#nitro/virtual/app' ? 'export const app = {}' : undefined,
    }],
  } as unknown as Nuxt
}

beforeAll(async () => {
  await mkdir(join(buildDir, 'types'), { recursive: true })
  await mkdir(join(buildDir, 'dist/server'), { recursive: true })
  await writeFile(join(buildDir, 'tsconfig.json'), '{}')
  await writeFile(join(buildDir, 'types/app.config.d.ts'), 'export {}')
  await writeFile(join(buildDir, 'dist/server/server.mjs'), '')
  await writeFile(join(rootDir, '.env'), 'SECRET=1')
  await writeFile(join(buildDir, 'app-secret'), 'a'.repeat(64))
  await mkdir(join(buildDir, 'manifest'), { recursive: true })
  await writeFile(join(buildDir, 'manifest/latest.json'), '{}')
  await writeFile(join(buildDir, 'nuxt.lock'), '{}')
})

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

describe('dev build directory at /.nuxt/', () => {
  it('lists files on disk and in memory as markdown, grouped by what adds them', async () => {
    const response = await handleBuildDirRequest(createFakeNuxt(), '/.nuxt/')
    expect(response?.type).toBe('text/markdown; charset=utf-8')
    expect(response?.body).toContain('Append a path to this URL')
    expect(response?.body).toContain('- nuxt: layouts.mjs\n- @nuxt/content: content/manifest.mjs\n- unknown: routes.mjs\n')
    expect(response?.body).toContain('## On disk\n\n- tsconfig.json, types/app.config.d.ts\n')
    expect(response?.body).toContain('- #nitro/virtual/app, /project/virtual-plugin.mjs\n')
    // build output and dev server state are not listed, but can still be read
    for (const unlisted of ['dist/', 'manifest/', 'nuxt.lock']) {
      expect(response?.body).not.toContain(unlisted)
    }
    expect(await handleBuildDirRequest(createFakeNuxt(), '/.nuxt/manifest/latest.json')).toMatchObject({ status: 200, body: '{}' })
  })

  it('shows the markdown inline in a browser', async () => {
    const response = await handleBuildDirRequest(createFakeNuxt(), '/.nuxt/', 'text/html,*/*')
    expect(response?.type).toBe('text/plain; charset=utf-8')
  })

  it('lists a subdirectory, with or without a trailing slash', async () => {
    const nuxt = createFakeNuxt()
    for (const pathname of ['/.nuxt/content/', '/.nuxt/content']) {
      const response = await handleBuildDirRequest(nuxt, pathname)
      expect(response?.body).toContain('# `/.nuxt/content/`')
      expect(response?.body).toContain('- @nuxt/content: content/manifest.mjs\n')
      expect(response?.body).not.toContain('routes.mjs')
    }
  })

  it('returns a file as plain text, wherever it lives', async () => {
    const nuxt = createFakeNuxt()
    expect(await handleBuildDirRequest(nuxt, '/.nuxt/routes.mjs')).toMatchObject({ status: 200, type: 'text/plain; charset=utf-8', body: 'export default []' })
    expect(await handleBuildDirRequest(nuxt, '/.nuxt/types/app.config.d.ts')).toMatchObject({ status: 200, body: 'export {}' })
    expect(await handleBuildDirRequest(nuxt, '/.nuxt/@id/%23nitro%2Fvirtual%2Fapp')).toMatchObject({ status: 200, body: 'export const app = {}' })
    expect(await handleBuildDirRequest(nuxt, '/.nuxt/missing.mjs')).toMatchObject({ status: 404 })
  })

  it('answers with JSON when asked', async () => {
    const nuxt = createFakeNuxt()
    const listing = JSON.parse((await handleBuildDirRequest(nuxt, '/.nuxt/', 'application/json'))!.body)
    expect(listing.entries).toContainEqual({ path: 'routes.mjs', virtual: true })
    expect(listing.entries).toContainEqual({ path: '@id/%23nitro%2Fvirtual%2Fapp', virtual: true })
    const file = JSON.parse((await handleBuildDirRequest(nuxt, '/.nuxt/content/manifest.mjs', 'application/json'))!.body)
    expect(file).toEqual({ path: 'content/manifest.mjs', virtual: true, source: '@nuxt/content', content: 'export const manifest = {}' })
  })

  it('does not leave the build directory', async () => {
    const nuxt = createFakeNuxt()
    expect(await handleBuildDirRequest(nuxt, '/.nuxt/%2e%2e/.env')).toMatchObject({ status: 404 })
    expect(await handleBuildDirRequest(nuxt, '/.nuxt/%E0%A4%A')).toMatchObject({ status: 400 })
    // the generated dev app secret stays private
    expect(await handleBuildDirRequest(nuxt, '/.nuxt/app-secret')).toMatchObject({ status: 404 })
    expect(await handleBuildDirRequest(nuxt, '/.nuxt/types/../app-secret')).toMatchObject({ status: 404 })
    expect((await handleBuildDirRequest(nuxt, '/.nuxt/'))?.body).not.toContain('app-secret')
  })

  it('answers as a portable dev server handler', async () => {
    const handler = createBuildDirHandler(createFakeNuxt())
    const req = new Request('http://localhost:3000/.nuxt/routes.mjs')
    const response = await handler({ req, url: new URL(req.url), res: { headers: new Headers() }, context: {} } as unknown as RequestEvent)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe('export default []')
  })
})
