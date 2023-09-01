import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { execa } from 'execa'

const dirs = await fg('*', {
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
