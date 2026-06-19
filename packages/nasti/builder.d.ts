// Types for the `#builder` subpath import (see `builder.mjs`). This is a *plain* module
// (the adjacent `.d.ts` for `builder.mjs`), deliberately NOT a global `declare module
// '#builder'` block: the webpack/rspack builders already declare `#builder` ambiently with
// a different (webpack-shaped) surface, and a second global declaration would collide with
// theirs across the workspace typecheck. Resolving via the package's `imports` field keeps
// Nasti's `#builder` types scoped to this package.
export * from '@nasti-toolchain/nasti'
export const builder: 'nasti'
