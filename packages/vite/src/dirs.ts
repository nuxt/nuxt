import { fileURLToPath } from 'url'
import { dirname, resolve } from 'pathe'

export const distDir = dirname(fileURLToPath(import.meta.url))
export const pkgDir = resolve(distDir, '..')
