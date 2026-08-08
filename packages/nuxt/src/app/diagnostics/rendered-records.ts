import type { RouteRecordNormalized } from 'vue-router'

const mountedRecords = new WeakMap<RouteRecordNormalized, number>()

export function trackRenderedRecord (record: RouteRecordNormalized): () => void {
  mountedRecords.set(record, (mountedRecords.get(record) ?? 0) + 1)
  return () => {
    const count = (mountedRecords.get(record) ?? 0) - 1
    if (count > 0) {
      mountedRecords.set(record, count)
    } else {
      mountedRecords.delete(record)
    }
  }
}

export function isRecordRendered (record: RouteRecordNormalized): boolean {
  return (mountedRecords.get(record) ?? 0) > 0
}
