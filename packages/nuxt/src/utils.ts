import { promises as fsp } from 'node:fs'

export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export async function isDirectory (path: string) {
  return (await fsp.lstat(path)).isDirectory()
}
