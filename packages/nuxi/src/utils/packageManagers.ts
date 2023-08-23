import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'pathe'
import { findup } from './fs'

export const packageManagerLocks = {
  yarn: 'yarn.lock',
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  bun: 'bun.lockb'
}

type PackageManager = keyof typeof packageManagerLocks

export function getPackageManager (rootDir: string) {
  return findup(rootDir, (dir) => {
    for (const name in packageManagerLocks) {
      const path = packageManagerLocks[name as PackageManager]
      if (path && existsSync(resolve(dir, path))) {
        return name
      }
    }
  }) as PackageManager | null
}

export function getPackageManagerVersion (name: string) {
  return execSync(`${name} --version`).toString('utf8').trim()
}
