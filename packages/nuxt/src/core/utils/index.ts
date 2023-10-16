export * from './names'
export * from './plugins'

export function uniqueBy<T, K extends keyof T> (arr: T[], key: K) {
  const res: T[] = []
  const seen = new Set<T[K]>()
  for (const item of arr) {
    if (seen.has(item[key])) { continue }
    seen.add(item[key])
    res.push(item)
  }
  return res
}
