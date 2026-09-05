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

async function prepareFixture (dir: string, retries = 2) {
  try {
    return await exec('pnpm', ['nuxt', 'prepare'], { nodeOptions: { cwd: dir }, throwOnError: true })
  } catch (error) {
    // `nuxt prepare` clears the build dir with a non-retrying recursive `fs.rm`,
    // which throws spurious ENOTEMPTY/ENOENT under parallel load on CI.
    const stderr = (error as { output?: { stderr?: string } }).output?.stderr ?? ''
    if (retries > 0 && /ENOTEMPTY|ENOENT/.test(stderr)) {
      return prepareFixture(dir, retries - 1)
    }
    throw error
  }
}

export function prepareFixtures (dirs: string[]) {
  return Promise.all(dirs.map(dir => prepareFixture(dir)))
}

let prepared: Promise<unknown> | undefined

export function ensureFixturesPrepared () {
  prepared ??= getFixtureDirs().then(dirs => prepareFixtures(dirs.filter(dir => !existsSync(`${dir}/.nuxt/tsconfig.json`))))
  return prepared
}
