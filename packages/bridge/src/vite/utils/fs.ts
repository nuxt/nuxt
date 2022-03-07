import { promises as fsp, readdirSync, statSync } from 'fs'
import { join } from 'pathe'

export function readDirRecursively (dir: string) {
  return readdirSync(dir).reduce((files, file) => {
    const name = join(dir, file)
    const isDirectory = statSync(name).isDirectory()
    return isDirectory ? [...files, ...readDirRecursively(name)] : [...files, name]
  }, [])
}

export async function isDirectory (path: string) {
  try {
    return (await fsp.stat(path)).isDirectory()
  } catch (_err) {
    return false
  }
}
