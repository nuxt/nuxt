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
  delete process.env.NUXT_APP_SECRET_GENERATED
  await Promise.all(buildDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('resolveDevAppSecret', () => {
  it('should generate and persist a secret when none is configured', async () => {
    const options = await createOptions()
    const env: Record<string, string> = {}

    await resolveDevAppSecret(options, env)

    expect(options.runtimeConfig.appSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(await readFile(join(options.buildDir, 'app-secret'), 'utf8')).toBe(options.runtimeConfig.appSecret)
    expect(env).toStrictEqual({ NUXT_APP_SECRET_GENERATED: '1' })
  })

  it('should reuse a persisted secret', async () => {
    const options = await createOptions()
    const persisted = 'a'.repeat(64)
    await writeFile(join(options.buildDir, 'app-secret'), persisted, 'utf8')
    const env: Record<string, string> = {}

    await resolveDevAppSecret(options, env)

    expect(options.runtimeConfig.appSecret).toBe(persisted)
    expect(env.NUXT_APP_SECRET_GENERATED).toBe('1')
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
    const env: Record<string, string> = { NUXT_APP_SECRET: 'y'.repeat(40), NUXT_APP_SECRET_GENERATED: '1' }

    await resolveDevAppSecret(options, env)

    expect(env.NUXT_APP_SECRET_GENERATED).toBeUndefined()

    expect(options.runtimeConfig.appSecret).toBe('')
    expect(env.NUXT_APP_SECRET).toBe('y'.repeat(40))
    expect(existsSync(join(options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should preserve a configured secret that is too short', async () => {
    const options = await createOptions('too-short')

    await resolveDevAppSecret(options, {})

    expect(options.runtimeConfig.appSecret).toBe('too-short')
    expect(existsSync(join(options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should preserve a configured secret that is not a string', async () => {
    const options = await createOptions(12345 as unknown as string)

    await resolveDevAppSecret(options, {})

    expect(options.runtimeConfig.appSecret).toBe(12345)
    expect(existsSync(join(options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should preserve a configured environment secret when another is empty', async () => {
    const options = await createOptions()
    const env: Record<string, string> = { NITRO_APP_SECRET: '', NUXT_APP_SECRET: 'z'.repeat(40) }

    await resolveDevAppSecret(options, env)

    expect(env).toStrictEqual({ NITRO_APP_SECRET: '', NUXT_APP_SECRET: 'z'.repeat(40) })
    expect(existsSync(join(options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should preserve an environment secret that is too short', async () => {
    const options = await createOptions()
    const env: Record<string, string> = { NUXT_APP_SECRET: 'too-short' }

    await resolveDevAppSecret(options, env)

    expect(options.runtimeConfig.appSecret).toBe('')
    expect(env.NUXT_APP_SECRET).toBe('too-short')
    expect(existsSync(join(options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should generate a secret and update the environment when it is empty', async () => {
    const options = await createOptions()
    const env: Record<string, string> = { NITRO_APP_SECRET: '', NUXT_APP_SECRET: '' }

    await resolveDevAppSecret(options, env)

    expect(options.runtimeConfig.appSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(env.NITRO_APP_SECRET).toBe(options.runtimeConfig.appSecret)
    expect(env.NUXT_APP_SECRET).toBe(options.runtimeConfig.appSecret)
    expect(await readFile(join(options.buildDir, 'app-secret'), 'utf8')).toBe(options.runtimeConfig.appSecret)
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
    expect(process.env.NUXT_APP_SECRET_GENERATED).toBeUndefined()
    expect(existsSync(join(nuxt.options.buildDir, 'app-secret'))).toBe(false)
  })

  it('should not warn when generating a secret', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const options = await createOptions('', false)

    await resolveDevAppSecret(options, {})

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
