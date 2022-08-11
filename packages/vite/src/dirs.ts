import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

let _distDir = dirname(fileURLToPath(import.meta.url))
if (_distDir.match(/(chunks|shared)$/)) { _distDir = dirname(_distDir) }
export const distDir = _distDir
export const pkgDir = resolve(distDir, '..')
