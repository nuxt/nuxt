import { fileURLToPath } from 'node:url'
import { globby } from 'globby'
import fs from 'fs-extra'
import { execa } from 'execa'

async function initTesting () {
  const dirs = await globby('*', {
    onlyDirectories: true,
    cwd: fileURLToPath(new URL('./fixtures', import.meta.url)),
    absolute: true
  })

  await Promise.all([
    // clear nuxt build files
    ...dirs.map(dir => fs.remove(`${dir}/.nuxt`)),
    // clear vite cache
    ...dirs.map(dir => fs.remove(`${dir}/node_modules/.cache`), { force: true })
  ])

  await Promise.all(
    dirs.map(dir => execa('pnpm', ['nuxi', 'prepare'], { cwd: dir }))
  )
}

initTesting()
