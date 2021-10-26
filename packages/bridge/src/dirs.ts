import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { join } from 'path'
import { dirname } from 'pathe'

let dir = dirname(fileURLToPath(import.meta.url))
while (dir !== '/' && !existsSync(join(dir, 'package.json'))) {
  dir = dirname(dir)
}
export const pkgDir = dir
export const distDir = join(pkgDir, 'dist')
