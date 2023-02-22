export function badSideEffect () {
  // ...
}

throw new Error('composables/badSideEffect.ts should be tree-shaken')
