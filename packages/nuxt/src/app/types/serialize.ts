/**
 * Models what `JSON.parse(JSON.stringify(value))` produces, so that response types describe what
 * a client actually receives over the wire rather than what the handler returned.
 *
 * Derived from remix's implementation.
 *
 * @see https://github.com/remix-run/remix/blob/2248669ed59fd716e267ea41df5d665d4781f4a9/packages/remix-server-runtime/serialize.ts
 */

/** A value JSON can represent directly. */
export type JsonPrimitive = string | number | boolean | null

/** A value JSON cannot represent, dropped or nulled depending on where it appears. */
export type NonJsonPrimitive = undefined | ((...args: any[]) => any) | symbol

/** @internal */
type IsAny<T> = 0 extends 1 & T ? true : false

/** @internal */
type FilterKeys<T extends object, Filter> = { [K in keyof T]: T[K] extends Filter ? K : never }[keyof T]

/**
 * The type `T` becomes once serialized to JSON and parsed back:
 * - `undefined`, functions and symbols are dropped from objects and nulled in tuples and arrays
 * - `Map` and `Set` become empty objects
 * - anything with a `toJSON()` method becomes that method's return type
 * - `Date`, being `toJSON()`-bearing, becomes `string`
 */
export type Serialize<T> = IsAny<T> extends true
  ? any
  : T extends JsonPrimitive | undefined
    ? T
    : T extends Map<any, any> | Set<any>
      ? Record<string, never>
      : T extends NonJsonPrimitive
        ? never
        : T extends { toJSON: () => infer U }
          ? U
          : T extends []
            ? []
            : T extends [unknown, ...unknown[]]
              ? SerializeTuple<T>
              : T extends ReadonlyArray<infer U>
                ? (U extends NonJsonPrimitive ? null : Serialize<U>)[]
                : T extends object
                  ? SerializeObject<T>
                  : never

/** JSON-serializes a [tuple](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types), nulling entries JSON cannot represent. */
export type SerializeTuple<T extends [unknown, ...unknown[]]> = {
  [K in keyof T]: T[K] extends NonJsonPrimitive ? null : Serialize<T[K]>
}

/** JSON-serializes an object or class instance, dropping keys JSON cannot represent. */
export type SerializeObject<T extends object> = {
  [K in keyof Omit<T, FilterKeys<T, NonJsonPrimitive>>]: Serialize<T[K]>
}

/**
 * Flattens a type so editors display its resolved members rather than a chain of wrappers.
 *
 * @see https://github.com/ianstormtaylor/superstruct/blob/7973400cd04d8ad92bbdc2b6f35acbfb3c934079/src/utils.ts#L323-L325
 */
export type Simplify<T> = T extends any[] | Date ? T : { [K in keyof T]: Simplify<T[K]> }
