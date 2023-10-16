import { basename, extname } from 'pathe'
import { kebabCase } from 'scule'

export function getNameFromPath (path: string) {
  return kebabCase(basename(path).replace(extname(path), '')).replace(/["']/g, '')
}

export function hasSuffix (path: string, suffix: string) {
  return basename(path).replace(extname(path), '').endsWith(suffix)
}

export function getNameFromPathLocal (path: string, src: string) {
  const sourcePath = path
    .replace(src + '/', '')
    .split('/')
    .slice(0, -1)
    // .map(e => snakeCase(e))
    .join('/')
  return (
    sourcePath +
    (sourcePath ? '/' : '') +
    kebabCase(basename(path).replace(extname(path), '')).replace(/["']/g, '')
  )
}
