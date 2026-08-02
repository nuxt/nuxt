import { describe, expect, it } from 'vitest'

import { parseStaticImports } from '../src/core/utils/static-imports.ts'

describe('parseStaticImports', () => {
  it('should extract default, named and namespaced imports', () => {
    const code = [
      `import a, { b, c as d } from './x'`,
      `import * as ns from './y'`,
      `import './side-effect'`,
      `import e from "./quoted";`,
    ].join('\n')

    expect(parseStaticImports(code, 'file.ts')).toMatchInlineSnapshot(`
      [
        {
          "code": "import a, { b, c as d } from './x'",
          "defaultImport": "a",
          "end": 34,
          "namedImports": {
            "b": "b",
            "c": "d",
          },
          "specifier": "./x",
          "start": 0,
        },
        {
          "code": "import * as ns from './y'",
          "end": 60,
          "namedImports": {},
          "namespacedImport": "ns",
          "specifier": "./y",
          "start": 35,
        },
        {
          "code": "import './side-effect'",
          "end": 83,
          "namedImports": {},
          "specifier": "./side-effect",
          "start": 61,
        },
        {
          "code": "import e from "./quoted";",
          "defaultImport": "e",
          "end": 109,
          "namedImports": {},
          "specifier": "./quoted",
          "start": 84,
        },
      ]
    `)
  })

  it('should omit type-only imports', () => {
    const code = `import type { T } from './t'\nimport { type U, v } from './u'`

    expect(parseStaticImports(code, 'file.ts')).toMatchObject([
      { specifier: './t', namedImports: {} },
      { specifier: './u', namedImports: { v: 'v' } },
    ])
  })

  it('should parse TypeScript in a `<script>` block of a `.vue` file', () => {
    const code = `import { a } from './a'\nconst b: string = a`

    expect(parseStaticImports(code, 'component.vue')).toMatchObject([
      { specifier: './a', namedImports: { a: 'a' } },
    ])
  })
})
