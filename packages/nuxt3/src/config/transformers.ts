import { defaultsDeep } from 'lodash'

export type Optional<T> = {
    -readonly [K in keyof T]?: T[K] extends Function ? T[K] : T[K] extends RegExp ? T[K] : T[K] extends Promise<any> ? T[K] : T[K] extends Array<infer R> ? Array<R> : Optional<T[K]>
}

export function setProp<O extends Record<string, any>, K extends string, V> (obj: O, key: K, value: V): asserts obj is O & { [key in K]: V } {
  (obj as { [key in K]: V })[key] = value
}

type Override<O extends Record<string, any>, K extends keyof O, V> = K extends Array<infer A> ? {
    [P in keyof O]: K extends P ? O[P] extends Array<infer T> ? Array<A & T> : K | O[P] : O[P]
} : O & { [key in K]: V }

export function overrideProp<O extends Record<string, any>, K extends keyof O, V> (obj: O, key: K, value: V): asserts obj is Override<O, K, V> {
  (obj as { [key in K]: V })[key] = value
}

export function deleteProp<O extends Record<string, any>, K extends string> (obj: O, key: K): asserts obj is Exclude<O, K> {
  delete obj[key]
}

type MergeArrays<S, T> = S extends Array<infer A1> ? T extends Array<infer A2> ? Array<A1 | A2> : T | Array<A1> : T | S
type MergeObjects<S extends Record<string, any>, T extends Record<string, any>> = Omit<S & T, keyof S & keyof T> & {
  // eslint-disable-next-line no-use-before-define
    -readonly [K in keyof S & keyof T]: Merge<S[K], T[K]>
}
type Merge<S, T> = S extends Array<any> ? MergeArrays<S, T> : S extends Function ? S | T : S extends RegExp ? S | T : S extends Promise<any> ? S | T : T extends Function ? S | T : S extends Record<string, any> ? T extends Record<string, any> ? MergeObjects<S, T> : S | T : MergeArrays<S, T>

// let b: Merged<{ test: string, another: number[] }, { third: () => void, another: string[] }> = {} as any
// b.another
// let c = b
// c.

// T extends Array<infer A> ? Array<Merged<A, S>> : T

export function mergeConfigs<Dest extends Record<string, any>, Source extends Record<string, any>> (dest: Dest, source: Source): Merge<Dest, Source> {
  return defaultsDeep(dest, source)
}
