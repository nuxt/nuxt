export function defineGetter (obj, key, val) {
  Object.defineProperty(obj, key, { get: () => val })
}
