import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { parseStaticImports } from '../src/core/utils/static-imports.ts'
import { processImports } from '../src/core/utils/parse-utils.ts'

const identifier = fc.constantFrom('a', 'b', 'c', 'd', 'foo', 'Bar', '_x', '$y')
const specifier = fc.constantFrom('./x', './y.mjs', 'vue', '#imports', '~/utils/thing', '@scope/pkg/sub')

interface Statement {
  specifier: string
  defaultImport?: string
  namespacedImport?: string
  namedImports: Array<[string, string, boolean]>
  typeOnly: boolean
}

const statement: fc.Arbitrary<Statement> = fc.record({
  specifier,
  defaultImport: fc.option(identifier, { nil: undefined }),
  namespacedImport: fc.option(identifier, { nil: undefined }),
  namedImports: fc.uniqueArray(fc.tuple(identifier, identifier, fc.boolean()), { maxLength: 3, selector: ([imported]) => imported }),
  typeOnly: fc.boolean(),
}).filter(s => !(s.namespacedImport && s.namedImports.length))

function print (statement: Statement) {
  const clauses: string[] = []
  if (statement.defaultImport) { clauses.push(statement.defaultImport) }
  if (statement.namespacedImport) { clauses.push(`* as ${statement.namespacedImport}`) }
  if (statement.namedImports.length) {
    clauses.push(`{ ${statement.namedImports.map(([imported, local, typeOnly]) => `${typeOnly ? 'type ' : ''}${imported === local ? imported : `${imported} as ${local}`}`).join(', ')} }`)
  }
  const type = statement.typeOnly ? 'type ' : ''
  return clauses.length
    ? `import ${type}${clauses.join(', ')} from '${statement.specifier}'`
    : `import '${statement.specifier}'`
}

function withUniqueLocals (statements: Statement[]): Statement[] {
  const seen = new Set<string>()
  const take = (name: string | undefined) => {
    if (!name || seen.has(name)) { return undefined }
    seen.add(name)
    return name
  }
  return statements.map(statement => ({
    ...statement,
    defaultImport: take(statement.defaultImport),
    namespacedImport: take(statement.namespacedImport),
    namedImports: statement.namedImports.filter(([, local]) => take(local) !== undefined),
  }))
}

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

  it('should register both bindings of a combined default and namespace import', () => {
    const { directImports, namespaces } = processImports(parseStaticImports(`import a, * as ns from './x'`, 'file.ts'), {})
    expect(directImports.get('a')).toEqual({ originalName: 'default', source: './x' })
    expect(namespaces.get('./x')?.namespaces).toEqual(new Set(['a', 'ns']))
  })

  it('should round-trip printed import statements', () => {
    fc.assert(fc.property(fc.array(statement, { minLength: 1, maxLength: 3 }), (statements) => {
      const lines = statements.map(print)
      const code = lines.join('\n')
      const parsed = parseStaticImports(code, 'file.ts')

      expect(parsed).toHaveLength(statements.length)
      for (const [index, statement] of statements.entries()) {
        const entry = parsed[index]!
        expect(entry.code).toBe(lines[index])
        expect(code.slice(entry.start, entry.end)).toBe(lines[index])
        expect(entry.specifier).toBe(statement.specifier)
        if (statement.typeOnly) {
          expect(entry.defaultImport).toBeUndefined()
          expect(entry.namespacedImport).toBeUndefined()
          expect(entry.namedImports).toEqual({})
          continue
        }
        expect(entry.defaultImport).toBe(statement.defaultImport)
        expect(entry.namespacedImport).toBe(statement.namespacedImport)
        expect(entry.namedImports).toEqual(Object.fromEntries(statement.namedImports.filter(([,, typeOnly]) => !typeOnly).map(([imported, local]) => [imported, local])))
      }
    }), { numRuns: 500 })
  })

  it('should resolve every value binding introduced by the imports', () => {
    fc.assert(fc.property(fc.array(statement, { minLength: 1, maxLength: 3 }).map(withUniqueLocals), (statements) => {
      const code = statements.map(print).join('\n')
      const { directImports, namespaces } = processImports(parseStaticImports(code, 'file.ts'), { '~': '/root', '@scope/pkg': '/root/pkg' })

      for (const statement of statements) {
        if (statement.typeOnly) { continue }
        for (const [imported, local] of statement.namedImports.filter(([,, typeOnly]) => !typeOnly)) {
          const entry = directImports.get(local)
          expect(entry, `${local} from ${statement.specifier}`).toBeDefined()
          if (entry!.source.endsWith(statement.specifier.replace(/\.mjs$/, ''))) {
            expect(entry!.originalName).toBe(imported)
          }
        }
        if (statement.defaultImport) {
          expect(directImports.get(statement.defaultImport)).toBeDefined()
        }
        for (const local of [statement.defaultImport, statement.namespacedImport]) {
          if (!local) { continue }
          expect([...namespaces.values()].some(entry => entry.namespaces.has(local))).toBe(true)
        }
      }

      for (const source of namespaces.keys()) {
        expect(source).not.toMatch(/\.mjs$/)
        expect(source.startsWith('~')).toBe(false)
      }
    }), { numRuns: 500 })
  })
})
