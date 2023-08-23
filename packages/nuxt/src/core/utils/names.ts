import { basename, extname } from 'pathe'
import { kebabCase } from 'scule'

export function getNameFromPath (path: string) {
  return kebabCase(basename(path).replace(extname(path), '')).replace(/["']/g, '')
}

export function hasSuffix (path: string, suffix: string) {
  return basename(path).replace(extname(path), '').endsWith(suffix)
}
