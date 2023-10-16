import { basename, extname } from 'pathe'
import { kebabCase } from 'scule'
import { withTrailingSlash } from 'ufo'

export function getNameFromPath (path: string) {
  return kebabCase(basename(path).replace(extname(path), '')).replace(/["']/g, '')
}

export function hasSuffix (path: string, suffix: string) {
  return basename(path).replace(extname(path), '').endsWith(suffix)
}

export function getNameFromPathLocal (path: string, localDir: string) {
  const file = path.replace(withTrailingSlash(localDir), '')
  return getNameFromPath(file.replace(/[\\/]+/g, '-').replace(/\/index\.\w+$/, ''))
}
