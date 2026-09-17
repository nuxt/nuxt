import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import process from 'node:process'

import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadNuxt } from 'nuxt'
import type { NuxtOptions } from '@nuxt/schema'

import { resolveDevAppSecret } from '../src/core/app-secret.ts'

const buildDirs: string[] = []

async function createOptions (appSecret = '', test = true) {
  const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-app-secret-'))
  buildDirs.push(buildDir)
  return {
    buildDir,
    test,
    runtimeConfig: { appSecret },
  } as unknown as NuxtOptions
}

afterEach(async () => {
  delete process.env.NUXT_APP_SECRET
  delete process.env.NITRO_APP_SECRET
  await Promise.all(buildDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('resolveDevAppSecret', () => {
  it('should generate and persist a secret when none is configured', async () => {
    const options = await createOptions()
    const env: Record<string, string> = {}

    await resolveDevAppSecret(options, env)

    expect(options.runtimeConfig.appSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(await readFile(join(options.buildDir, 'app-secret'), 'utf8')).toBe(options.runtimeConfig.appSecret)
    expect(env).toStrictEqual({})
  })

  it('should reuse a persisted secret', async () => {
    const options = await createOptions()
    const persisted = 'a'.repeat(64)
    await writeFile(join(options.buildDir, 'app-secret'), persisted, 'utf8')

    await resolveDevAppSecret(options, {})

    expect(options.runtimeConfig.appSecret).toBe(persisted)
  })

  it('should regenerate a persisted secret that is not 32 hex-encoded bytes', async () => {
    const options = await createOptions()
    await writeFile(join(options.buildDir, 'app-secret'), 'not-a-secret', 'utf8')

    await resolveDevAppSecret(options, {})

    expect(options.runtimeConfig.appSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(await readFile(join(options.buildDir, 'app-secret'), 'utf8')).toBe(options.runtimeConfig.appSecret)
  })

  it('should leave a long enough configured secret alone', async () => {
    const configured = 'x'.repeat(32)
    const options = await createOptions(configured)

    await resolveDevAppSecret(options, {})

    expect(options.runtimeConfig.appSecret).toBe(configured)
    expect(existsSync(join(options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should leave a long enough environment secret alone', async () => {
    const options = await createOptions()
    const env = { NUXT_APP_SECRET: 'y'.repeat(40) }

    await resolveDevAppSecret(options, env)

    expect(options.runtimeConfig.appSecret).toBe('')
    expect(env.NUXT_APP_SECRET).toBe('y'.repeat(40))
    expect(existsSync(join(options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should replace a short environment secret', async () => {
    const options = await createOptions()
    const env: Record<string, string> = { NUXT_APP_SECRET: 'too-short' }

    await resolveDevAppSecret(options, env)

    expect(options.runtimeConfig.appSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(env.NUXT_APP_SECRET).toBe(options.runtimeConfig.appSecret)
  })

  it('should replace a short `NITRO_` secret, which nitro reads in preference', async () => {
    const options = await createOptions()
    const env: Record<string, string> = { NITRO_APP_SECRET: 'short', NUXT_APP_SECRET: 'z'.repeat(40) }

    await resolveDevAppSecret(options, env)

    expect(env.NITRO_APP_SECRET).toMatch(/^[0-9a-f]{64}$/)
    expect(env.NUXT_APP_SECRET).toBe(env.NITRO_APP_SECRET)
  })

  it('should be applied when loading Nuxt in development', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-app-secret-root-'))
    buildDirs.push(rootDir)
    await writeFile(join(rootDir, 'package.json'), JSON.stringify({ private: true, type: 'module', name: 'fixture-app-secret' }))

    const nuxt = await loadNuxt({ cwd: rootDir, ready: false, overrides: { dev: true } })
    const secret = nuxt.options.runtimeConfig.appSecret

    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(await readFile(join(nuxt.options.buildDir, 'app-secret'), 'utf8')).toBe(secret)

    const restarted = await loadNuxt({ cwd: rootDir, ready: false, overrides: { dev: true } })
    expect(restarted.options.runtimeConfig.appSecret).toBe(secret)
  })

  it('should not be applied when loading Nuxt for a build', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-app-secret-root-'))
    buildDirs.push(rootDir)
    await writeFile(join(rootDir, 'package.json'), JSON.stringify({ private: true, type: 'module', name: 'fixture-app-secret' }))

    const nuxt = await loadNuxt({ cwd: rootDir, ready: false, overrides: { dev: false } })

    expect(nuxt.options.runtimeConfig.appSecret).toBe('')
    expect(existsSync(join(nuxt.options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should warn once outside test mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const options = await createOptions('', false)

    await resolveDevAppSecret(options, {})

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]!.join(' ')).toContain('NUXT_B5028')
    warn.mockRestore()
  })
})
