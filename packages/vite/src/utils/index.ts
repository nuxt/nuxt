import { promises as fsp, readdirSync, statSync } from 'node:fs'
import { hash } from 'ohash'
import { join } from 'pathe'

export function uniq<T> (arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// Copied from vue-bundle-renderer utils
const IS_JS_RE = /\.[cm]?js(\?[^.]+)?$/
const IS_MODULE_RE = /\.mjs(\?[^.]+)?$/
const HAS_EXT_RE = /[^./]+\.[^./]+$/
const IS_CSS_RE = /\.(?:css|scss|sass|postcss|less|stylus|styl)(\?[^.]+)?$/

export function isJS (file: string) {
  return IS_JS_RE.test(file) || !HAS_EXT_RE.test(file)
}

export function isModule (file: string) {
  return IS_MODULE_RE.test(file) || !HAS_EXT_RE.test(file)
}

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
}

export function hashId (id: string) {
  return '$id_' + hash(id)
}

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
