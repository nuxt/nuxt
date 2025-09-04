import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'

import { glob } from 'tinyglobby'
import { exec } from 'tinyexec'

async function initTesting () {
  const dirs = await glob(['*'], {
    onlyDirectories: true,
    cwd: fileURLToPath(new URL('./fixtures', import.meta.url)),
    absolute: true,
  })

  await Promise.all([
    // clear nuxt build files
    ...dirs.map(dir => rm(`${dir}/.nuxt`, { force: true, recursive: true })),
    // clear vite cache
    ...dirs.map(dir => rm(`${dir}/node_modules/.cache`, { force: true, recursive: true })),
  ])

  await Promise.all(
    dirs.map(dir => exec('pnpm', ['nuxt', 'prepare'], { nodeOptions: { cwd: dir } })),
  )
}

initTesting()
