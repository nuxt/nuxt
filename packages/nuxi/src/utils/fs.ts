import { promises as fsp } from 'node:fs'
import { dirname, resolve } from 'pathe'
import consola from 'consola'

// Check if a file exists
export async function exists (path: string) {
  try {
    await fsp.access(path)
    return true
  } catch {
    return false
  }
}

export async function clearDir (path: string) {
  await fsp.rm(path, { recursive: true, force: true })
  await fsp.mkdir(path, { recursive: true })
}

export async function rmRecursive (paths: string[]) {
  await Promise.all(paths.filter(p => typeof p === 'string').map(async (path) => {
    consola.debug('Removing recursive path', path)
    await fsp.rm(path, { recursive: true, force: true }).catch(() => {})
  }))
}

export async function touchFile (path: string) {
  const time = new Date()
  await fsp.utimes(path, time, time).catch(() => {})
}

export async function cleanupNuxtDirs (rootDir: string) {
  consola.info('Cleaning up generated nuxt files and caches...')

  await rmRecursive([
    '.nuxt',
    '.output',
    'dist',
    'node_modules/.vite',
    'node_modules/.cache'
  ].map(dir => resolve(rootDir, dir)))
}

export function findup<T> (rootDir: string, fn: (dir: string) => T | undefined): T | null {
  let dir = rootDir
  while (dir !== dirname(dir)) {
    const res = fn(dir)
    if (res) {
      return res
    }
    dir = dirname(dir)
  }
  return null
}
