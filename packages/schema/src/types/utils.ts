export type JavascriptExtension = 'js' | 'ts' | 'tsx' | 'jsx' | 'mjs' | 'cjs' | 'mts' | 'cts'
export type VueExtension = 'vue'

/**
 * Allows adding additional types to a property of an object.
 * If the property is an array, the type will be added to the array items.
 */
export type AugmentProperty<T extends Record<string, any>, K extends keyof T, V> = {
  [key in keyof T]: key extends K
    ? NonNullable<T[key]> extends Array<infer U>
      ? (U | V)[]
      : T[key]
    : T[key]
}
