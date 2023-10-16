import { basename, extname, normalize } from 'pathe'
import { kebabCase } from 'scule'
import { withTrailingSlash } from 'ufo'

export function getNameFromPath (path: string, relativeTo?: string) {
  const relativePath = relativeTo
    ? normalize(path).replace(withTrailingSlash(normalize(relativeTo)), '')
    : basename(path)
  return kebabCase(relativePath.replace(/\/index\.\w+$/, '').replace(/[\\/]+/g, '-').replace(extname(relativePath), '')).replace(/["']/g, '')
}

export function hasSuffix (path: string, suffix: string) {
  return basename(path).replace(extname(path), '').endsWith(suffix)
}
