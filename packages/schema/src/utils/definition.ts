import type { InputObject } from 'untyped'

import { defineUntypedSchema } from 'untyped'

import type { ConfigSchema } from '../types/schema'

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
  $schema?: InputObject['$schema']
  $default?: ReturnValue
}

type Resolvable<Namespace> = keyof Exclude<NonNullable<Namespace>, boolean | string | (() => any)> extends string
  ? {
    [K in keyof Namespace]: Partial<Resolvable<Namespace[K]>> | Resolvers<Namespace[K]>
  } | Namespace
  : Namespace | Resolvers<Namespace>

export function defineResolvers<C extends Partial<Resolvable<ConfigSchema>>> (config: C) {
  return defineUntypedSchema(config) /* as C */
}

export type ResolvableConfigSchema = Partial<Resolvable<ConfigSchema>>

export { defineUntypedSchema } from 'untyped'
