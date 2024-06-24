import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'

import { globby } from 'globby'

import { execa } from 'execa'

async function initTesting () {
  const dirs = await globby('*', {
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
    dirs.map(dir => execa('pnpm', ['nuxi', 'prepare'], { cwd: dir })),
  )
}

initTesting()
