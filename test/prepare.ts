import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { execa } from 'execa'

const dirs = await fg('*', {
  onlyDirectories: true,
  cwd: fileURLToPath(new URL('./fixtures', import.meta.url)),
  absolute: true
})

await Promise.all(
  dirs.map(dir => execa('pnpm', ['nuxi', 'prepare'], { cwd: dir }))
)
