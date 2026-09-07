import { rm } from 'node:fs/promises'

import { glob } from 'tinyglobby'

import { fixturesDir, getFixtureDirs, prepareFixtures } from './fixture-prepare.ts'

async function initTesting () {
  const dirs = await getFixtureDirs()

  const stalePerProjectDirs = await glob(['*/.nuxt-*', '*/.output-*'], {
    onlyDirectories: true,
    cwd: fixturesDir,
    absolute: true,
  })

  await Promise.all([
    // clear nuxt build files
    ...dirs.map(dir => rm(`${dir}/.nuxt`, { force: true, recursive: true })),
    ...stalePerProjectDirs.map(dir => rm(dir, { force: true, recursive: true })),
    // clear vite cache
    ...dirs.map(dir => rm(`${dir}/node_modules/.cache`, { force: true, recursive: true })),
  ])

  await prepareFixtures(dirs)
}

initTesting()
