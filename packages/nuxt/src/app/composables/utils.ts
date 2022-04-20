import { isRef, ref, Ref } from 'vue'

export const wrapInRef = <T> (value: T | Ref<T>) => isRef(value) ? value : ref(value)
