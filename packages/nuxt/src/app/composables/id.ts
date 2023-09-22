import type { DeepReadonly, Ref } from 'vue'
import { readonly, ref } from 'vue'
const useIdKeyPrefix = '$id'

export function useId (key?: string): DeepReadonly<Ref<string>>
export function useId (...args: any): DeepReadonly<Ref<string>> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') {
    args.unshift(autoKey)
  }
  const [_key] = args as [string]
  if (!_key || typeof _key !== 'string') {
    throw new TypeError('[nuxt] [useId] key must be a string: ' + _key)
  }

  return readonly(ref(useIdKeyPrefix + _key))
}
