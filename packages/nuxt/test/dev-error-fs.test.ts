import { mkdir, mkdtemp, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createErrorReport, createFsAccessCheck } from '../src/runtime/server/dev-error/index'

let root: string
let app: string
let store: string

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-dev-error-fs-')))
  app = join(root, 'app')
  store = join(root, 'store')
  await mkdir(join(app, 'layers'), { recursive: true })
  await mkdir(join(store, 'layer'), { recursive: true })
  await mkdir(join(root, 'other'), { recursive: true })
  await writeFile(join(app, 'page.js'), 'export const page = "APP_SOURCE"\n')
  await writeFile(join(app, '.env.local.js'), 'export const key = "DENIED_SOURCE"\n')
  await writeFile(join(store, 'layer', 'index.js'), 'export const layer = "LAYER_SOURCE"\n')
  await writeFile(join(root, 'other', 'config.js'), 'export const secret = "OUTSIDE_SOURCE"\n')
  await symlink(join(store, 'layer'), join(app, 'layers', 'base'))
  await symlink(join(root, 'other', 'config.js'), join(app, 'linked.js'))
})

/** An error whose message was rewritten after its stack was formatted, so the stack names `files` as frames. */
function forgedError (files: string[]): Error {
  const error = new Error(`not found:\n${files.map(file => `    at handler (${file}:1:1)`).join('\n')}`)
  void error.stack
  error.message = 'Request failed'
  return error
}

async function quoted (files: string[], canRead?: (file: string) => boolean): Promise<string> {
  return JSON.stringify(await createErrorReport(forgedError(files), { cwd: app, canRead }))
}

describe('createErrorReport', () => {
  it('should only quote files within `cwd` by default', async () => {
    const report = await quoted([join(app, 'page.js'), join(root, 'other', 'config.js'), join(app, 'linked.js'), join(app, 'layers', 'base', 'index.js')])
    expect(report).toContain('APP_SOURCE')
    expect(report).not.toContain('OUTSIDE_SOURCE')
    expect(report).not.toContain('LAYER_SOURCE')
  })

  it('should only quote files `canRead` allows by their real path', async () => {
    const canRead = await createFsAccessCheck({ allow: [app, store], deny: ['.env', '.env.*'] })
    const report = await quoted([
      join(app, 'page.js'),
      join(app, 'layers', 'base', 'index.js'),
      join(app, '.env.local.js'),
      join(root, 'other', 'config.js'),
      join(app, 'linked.js'),
    ], canRead)
    expect(report).toContain('APP_SOURCE')
    expect(report).toContain('LAYER_SOURCE')
    expect(report).not.toContain('DENIED_SOURCE')
    expect(report).not.toContain('OUTSIDE_SOURCE')
  })
})

describe('createFsAccessCheck', () => {
  it('should match `server.fs` allow and deny entries', async () => {
    const canRead = await createFsAccessCheck({ allow: ['/repo/', '/store'], deny: ['.env', '*.pem', '**/.git/**'] })
    expect(canRead('/repo/app.vue')).toBe(true)
    expect(canRead('/store/pkg/index.js')).toBe(true)
    expect(canRead('/repository/app.vue')).toBe(false)
    expect(canRead('/repo/.env')).toBe(false)
    expect(canRead('/repo/certs/KEY.PEM')).toBe(false)
    expect(canRead('/repo/.git/hooks/pre-commit.js')).toBe(false)
  })

  it('should allow every file when `server.fs.strict` is off', async () => {
    const canRead = await createFsAccessCheck({ allow: ['/repo'], deny: ['.env'], strict: false })
    expect(canRead('/elsewhere/config.js')).toBe(true)
  })
})
