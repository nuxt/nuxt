import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadBuilder } from '../src/core/builder.ts'
import { bundleServer } from '../src/core/server.ts'

type BuilderError = Error & { why: string, fix: string }

const roots: string[] = []

async function projectWithBuilder (builder: string, source?: string) {
  const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-builder-'))
  roots.push(rootDir)

  if (source) {
    const dir = join(rootDir, 'node_modules', builder)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: builder, version: '1.0.0', main: 'index.js' }))
    await writeFile(join(dir, 'index.js'), source)
  }

  vi.spyOn(console, 'error').mockImplementation(() => {})
  return rootDir
}

function loadFailure (load: () => Promise<unknown>): Promise<BuilderError> {
  return load().then(
    () => { throw new Error('Expected the builder to fail to load') },
    error => error as BuilderError,
  )
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('client builder loading', () => {
  it('reports the error raised while importing an installed builder', async () => {
    const rootDir = await projectWithBuilder('broken-builder', 'throw new Error(\'unstorage does not provide an export named `builtinDriverDependencies`\')')
    const nuxt = { options: { rootDir } }
    const error = await loadFailure(() => loadBuilder(nuxt as any, 'broken-builder'))

    expect(error.name).toBe('NUXT_B1017')
    expect(error.why).toContain('Loading `broken-builder` builder failed: ')
    expect(error.why).toContain('builtinDriverDependencies')
    expect(error.fix).toContain('`broken-builder` is installed')
    expect(error.fix).not.toContain('to install it')
  })

  it('asks to install a builder that is not in the project', async () => {
    const rootDir = await projectWithBuilder('missing-builder')
    const nuxt = { options: { rootDir } }
    const error = await loadFailure(() => loadBuilder(nuxt as any, 'missing-builder'))

    expect(error.name).toBe('NUXT_B1017')
    expect(error.why).toContain('Loading `missing-builder` builder failed: ')
    expect(error.fix).toContain('to install it')
    expect(error.fix).not.toContain('is installed')
  })
})

describe('server builder loading', () => {
  it('reports the error raised while importing an installed builder', async () => {
    const rootDir = await projectWithBuilder('broken-builder', 'throw new Error(\'unstorage does not provide an export named `builtinDriverDependencies`\')')
    const nuxt = { options: { rootDir, server: { builder: 'broken-builder' } }, callHook: async () => {} }
    const error = await loadFailure(() => bundleServer(nuxt as any))

    expect(error.name).toBe('NUXT_B1018')
    expect(error.why).toBe('Loading `broken-builder` server builder failed: unstorage does not provide an export named `builtinDriverDependencies`')
    expect(error.fix).toContain('`broken-builder` is installed')
    expect(error.fix).not.toContain('to install it')
    expect((error.cause as Error).message).toContain('builtinDriverDependencies')
  })

  it('asks to install a builder that is not in the project', async () => {
    const rootDir = await projectWithBuilder('missing-builder')
    const nuxt = { options: { rootDir, server: { builder: 'missing-builder' } }, callHook: async () => {} }
    const error = await loadFailure(() => bundleServer(nuxt as any))

    expect(error.name).toBe('NUXT_B1018')
    expect(error.why).toContain('Loading `missing-builder` server builder failed: ')
    expect(error.fix).toContain('to install it')
    expect(error.fix).not.toContain('is installed')
  })
})
