import { fileURLToPath } from 'node:url'
import { readdir, rm } from 'node:fs/promises'

import { execa } from 'execa'
import { join } from 'pathe'

async function initTesting () {
  const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url))
  const dirs = await readdir(fixturesDir)

  await Promise.all([
    // clear nuxt build files
    ...dirs.map(dir => rm(join(fixturesDir, `${dir}/.nuxt`), { force: true, recursive: true })),
    // clear vite cache
    ...dirs.map(dir => rm(join(fixturesDir, `${dir}/node_modules/.cache`), { force: true, recursive: true })),
  ])

  await Promise.all(
    dirs.map(dir => execa('pnpm', ['nuxi', 'prepare'], { cwd: join(fixturesDir, dir) })),
  )
}

initTesting()
