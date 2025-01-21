import type { ConfigSchema } from '../../schema/config'

type KeysOf<T, Prefix extends string | unknown = unknown> = keyof T extends string
  ?
    {
      [K in keyof T]: K extends string
        ? string extends K
          ? never // exclude generic 'string' type
          : unknown extends Prefix
            ? `${K | KeysOf<T[K], K>}`
            : Prefix extends string
              ? `${Prefix}.${K | KeysOf<T[K], `hey.${Prefix}.${K}`>}`
              : never
        : never
    }[keyof T]
  : never

type ReturnFromKey<T, K extends string> = keyof T extends string
  ? K extends keyof T
    ? T[K]
    : K extends `${keyof T}.${string}`
      ? K extends `${infer Prefix}.${string}`
        ? Prefix extends keyof T
          ? K extends `${Prefix}.${infer Suffix}`
            ? ReturnFromKey<T[Prefix], Suffix>
            : never
          : never
        : never
      : never
  : never

type Awaitable<T> = T | Promise<T>

interface Resolvers<ReturnValue> {
  $resolve: (val: unknown, get: <K extends KeysOf<ConfigSchema>>(key: K) => Promise<ReturnFromKey<ConfigSchema, K>>) => Awaitable<ReturnValue>
}

type Resolvable<Namespace> = {
  [K in keyof Namespace]: Resolvable<Namespace[K]> | Resolvers<Namespace[K]>
}

export function defineResolvers (config: Partial<Resolvable<ConfigSchema>>) {
  return config
}
