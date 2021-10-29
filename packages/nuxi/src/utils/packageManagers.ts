import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'pathe'
import { findup } from './fs'

export const packageManagerLocks = {
  yarn: 'yarn.lock',
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml'
}

export function getPackageManager (rootDir: string) {
  return findup(rootDir, (dir) => {
    for (const name in packageManagerLocks) {
      if (existsSync(resolve(dir, packageManagerLocks[name]))) {
        return name
      }
    }
  })
}

export function getPackageManagerVersion (name: string) {
  return execSync(`${name} --version`).toString('utf8').trim()
}
