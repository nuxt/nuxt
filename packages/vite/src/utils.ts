import { createHash } from 'crypto'

export function hashId (id: string) {
  return '$id_' + hash(id)
}

export function hash (input: string, length = 8) {
  return createHash('sha256')
    .update(input)
    .digest('hex')
    .substr(0, length)
}

export function uniq<T> (arr: T[]): T[] {
  return Array.from(new Set(arr))
}

const IS_CSS_RE = /\.css(\?[^.]+)?$/

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
}
