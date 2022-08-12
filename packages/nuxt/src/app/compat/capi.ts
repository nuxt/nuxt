export * from 'vue'

export const install = () => {}

export function set (target: any, key: string | number | symbol, val: any) {
  if (Array.isArray(target)) {
    target.length = Math.max(target.length, key as number)
    target.splice(key as number, 1, val)
    return val
  }
  target[key] = val
  return val
}

export function del (target: any, key: string | number | symbol) {
  if (Array.isArray(target)) {
    target.splice(key as number, 1)
    return
  }
  delete target[key]
}
