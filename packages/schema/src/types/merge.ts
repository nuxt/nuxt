/**
 * The result of merging module options over their defaults, as `defineNuxtModule` does.
 *
 * Nuxt owns this type so that the merge implementation can change without changing the shape
 * modules see. Kept deliberately close to `defu`'s semantics: objects merge recursively, arrays
 * concatenate, and nullish values fall through to the default.
 */

type MergeInput = Record<string | number | symbol, any>
type IgnoredMergeInput = boolean | number | null | any[] | Record<never, any> | undefined
type Nullish = null | undefined | void

type MergeArrays<Destination, Source> =
  Destination extends Array<infer DestinationType>
    ? Source extends Array<infer SourceType>
      ? Array<DestinationType | SourceType>
      : Source | Array<DestinationType>
    : Source | Destination

type MergeObjects<Destination extends MergeInput, Defaults extends MergeInput> =
  Destination extends Defaults
    ? Destination
    : Omit<Destination, keyof Destination & keyof Defaults>
      & Omit<Defaults, keyof Destination & keyof Defaults>
      & {
        -readonly [Key in keyof Destination & keyof Defaults]:
        Destination[Key] extends Nullish
          ? Defaults[Key] extends Nullish ? Nullish : Defaults[Key]
          : Defaults[Key] extends Nullish
            ? Destination[Key]
            : MergeValues<Destination[Key], Defaults[Key]>
      }

type MergeValues<Destination extends MergeInput, Defaults extends MergeInput> =
  Destination extends Nullish
    ? Defaults extends Nullish ? Nullish : Defaults
    : Defaults extends Nullish
      ? Destination
      : Destination extends Array<any>
        ? Defaults extends Array<any> ? MergeArrays<Destination, Defaults> : Destination | Defaults
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        : Destination extends Function | RegExp | Promise<any>
          ? Destination | Defaults
          // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
          : Defaults extends Function | RegExp | Promise<any>
            ? Destination | Defaults
            : Destination extends MergeInput
              ? Defaults extends MergeInput ? MergeObjects<Destination, Defaults> : Destination | Defaults
              : Destination | Defaults

/** Merge `Source` over each entry of `Defaults`, left to right. */
export type Merged<Source extends MergeInput, Defaults extends Array<MergeInput | IgnoredMergeInput>> =
  Defaults extends [infer First, ...infer Rest]
    ? First extends MergeInput
      ? Rest extends Array<MergeInput | IgnoredMergeInput>
        ? Merged<MergeObjects<Source, First>, Rest>
        : MergeObjects<Source, First>
      : First extends IgnoredMergeInput
        ? Rest extends Array<MergeInput | IgnoredMergeInput> ? Merged<Source, Rest> : Source
        : Source
    : Source
