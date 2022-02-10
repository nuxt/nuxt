import { fileURLToPath } from 'url'
import { dirname, resolve } from 'pathe'

let _distDir = dirname(fileURLToPath(import.meta.url))
if (_distDir.endsWith('chunks')) { _distDir = dirname(_distDir) }
export const distDir = _distDir
export const pkgDir = resolve(distDir, '..')
export const runtimeDir = resolve(distDir, 'runtime')
