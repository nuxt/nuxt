/// <reference path="../../internal.d.ts" />
import process from 'node:process'

import { entryURL } from '#nuxt-compat/import-meta'

// Nitro v2 rewrote `import.meta` to `globalThis._importMeta_` and seeded `{ url, env }` at
// the top of every emitted chunk, so a module dist built for it still dereferences the
// global, which Nitro v3 leaves undefined.
if (typeof (globalThis as { _importMeta_?: unknown })._importMeta_ === 'undefined') {
  Object.defineProperty(globalThis, '_importMeta_', {
    // writable, as nitro v2's plain assignment was, but not enumerable
    configurable: true,
    writable: true,
    enumerable: false,
    value: {
      url: entryURL,
      env: globalThis.process?.env || process.env || {},
    },
  })
}
