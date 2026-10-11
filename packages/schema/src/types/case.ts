/**
 * `SCREAMING_SNAKE_CASE` conversion at the type level, used to describe the environment variable
 * that overrides each runtime config key.
 *
 * Nuxt owns this type so the string-casing implementation can change without changing the
 * documented environment variable names. Kept deliberately close to `scule`'s `snakeCase`.
 */

type CaseSeparator = '-' | '_' | '/' | '.'

type FirstChar<S extends string> = S extends `${infer F}${string}` ? F : never
type WithoutFirstChar<S extends string> = S extends `${string}${infer R}` ? R : never
type IsUpper<S extends string> = S extends Uppercase<S> ? true : false
type IsLower<S extends string> = S extends Lowercase<S> ? true : false
type SameCase<X extends string, Y extends string> = IsUpper<X> extends IsUpper<Y> ? true : IsLower<X> extends IsLower<Y> ? true : false

type LastOf<T extends any[]> = T extends [...any, infer R] ? R : never
type WithoutLastOf<T extends any[]> = T extends [...infer F, any] ? F : never

type JoinLowercaseWords<T extends readonly string[], Joiner extends string, Accumulator extends string = ''> =
  T extends readonly [infer F extends string, ...infer R extends string[]]
    ? Accumulator extends ''
      ? JoinLowercaseWords<R, Joiner, `${Accumulator}${Lowercase<F>}`>
      : JoinLowercaseWords<R, Joiner, `${Accumulator}${Joiner}${Lowercase<F>}`>
    : Accumulator

type SplitByCase<T, Separator extends string = CaseSeparator, Accumulator extends unknown[] = []> =
  string extends Separator
    ? string[]
    : T extends `${infer F}${infer R}`
      ? [LastOf<Accumulator>] extends [never]
          ? SplitByCase<R, Separator, [F]>
          : LastOf<Accumulator> extends string
            ? R extends ''
              ? SplitByCase<R, Separator, [...WithoutLastOf<Accumulator>, `${LastOf<Accumulator>}${F}`]>
              : SameCase<F, FirstChar<R>> extends true
                ? F extends Separator
                  ? FirstChar<R> extends Separator
                    ? SplitByCase<R, Separator, [...Accumulator, '']>
                    : IsUpper<FirstChar<R>> extends true
                      ? SplitByCase<WithoutFirstChar<R>, Separator, [...Accumulator, FirstChar<R>]>
                      : SplitByCase<R, Separator, [...Accumulator, '']>
                  : SplitByCase<R, Separator, [...WithoutLastOf<Accumulator>, `${LastOf<Accumulator>}${F}`]>
                : IsLower<F> extends true
                  ? SplitByCase<WithoutFirstChar<R>, Separator, [...WithoutLastOf<Accumulator>, `${LastOf<Accumulator>}${F}`, FirstChar<R>]>
                  : SplitByCase<R, Separator, [...Accumulator, F]>
            : never
      : Accumulator extends []
        ? T extends '' ? [] : string[]
        : Accumulator

/** `snake_case` conversion at the type level. */
export type SnakeCase<T extends string | readonly string[]> =
  string extends T
    ? string
    : string[] extends T
      ? string
      : T extends string
        ? SplitByCase<T> extends readonly string[] ? JoinLowercaseWords<SplitByCase<T>, '_'> : never
        : T extends readonly string[] ? JoinLowercaseWords<T, '_'> : never
