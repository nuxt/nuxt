import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { glob } from 'tinyglobby'
import { exec } from 'tinyexec'

export const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url))

export function getFixtureDirs () {
  return glob(['*'], {
    onlyDirectories: true,
    cwd: fixturesDir,
    absolute: true,
  })
}

export function prepareFixtures (dirs: string[]) {
  return Promise.all(
    dirs.map(dir => exec('pnpm', ['nuxt', 'prepare'], { nodeOptions: { cwd: dir }, throwOnError: true })),
  )
}

let prepared: Promise<unknown> | undefined

export function ensureFixturesPrepared () {
  prepared ??= getFixtureDirs().then(dirs => prepareFixtures(dirs.filter(dir => !existsSync(`${dir}/.nuxt/tsconfig.json`))))
  return prepared
}
