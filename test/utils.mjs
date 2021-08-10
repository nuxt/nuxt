import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import defu from 'defu'
import hash from 'object-hash'
import execa from 'execa'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function resolveWorkspace (name) {
  return resolve(__dirname, '../', name)
}

export function fixtureDir (name) {
  return resolve(__dirname, 'fixtures', name)
}

export async function execNuxtCLI (args, opts) {
  const nuxtCLI = resolveWorkspace('packages/nuxi/bin/nuxi.js')
  await execa('node', [nuxtCLI, ...args], opts)
}

export async function loadFixture (opts, unhashedConfig) {
  const buildId = hash(opts)
  const buildDir = resolve(opts.rootDir, '.nuxt', buildId)
  const { loadNuxt } = await import('@nuxt/kit')
  const nuxt = await loadNuxt(defu(opts, { config: { buildDir, ...unhashedConfig } }))
  return nuxt
}

export async function buildFixture (opts) {
  const buildId = hash(opts)
  const buildDir = resolve(opts.rootDir, '.nuxt', buildId)

  const lockFile = resolve(opts.rootDir, `.build-${buildId}.lock`)
  mkdirpSync(dirname(lockFile))
  await waitWhile(() => isAlive(readSync(lockFile)))
  writeFileSync(lockFile, process.pid + '', 'utf8')

  try {
    const integrity = gitHead() // TODO: Calculate hash from project source
    const integrityFile = resolve(buildDir, '.integrity')
    const lastBuildIntegrity = readSync(integrityFile)
    if (integrity !== lastBuildIntegrity) {
      const nuxt = await loadFixture(opts)
      const { buildNuxt } = await import('@nuxt/kit')
      await buildNuxt(nuxt)
      await nuxt.close()
      await writeFileSync(integrityFile, integrity)
    }
  } finally {
    existsSync(lockFile) && rmSync(lockFile)
  }
}

function mkdirpSync (dir) {
  if (!existsSync(dir)) {
    mkdirpSync(dirname(dir))
    mkdirSync(dir)
  }
}

function readSync (file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function isAlive (pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

function waitWhile (check, interval = 100, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout')), timeout)
    const i = setInterval(() => {
      if (!check()) {
        clearTimeout(t)
        clearInterval(i)
        resolve(true)
      }
    }, interval)
  })
}

function gitHead () {
  return execSync('git rev-parse HEAD').toString('utf8').trim()
}
