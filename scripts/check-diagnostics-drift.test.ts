import { describe, expect, it } from 'vitest'

import { extractCodes, findDrift, readCodes } from './check-diagnostics-drift.ts'

function catalog (codes: Record<string, string>) {
  const entries = Object.entries(codes).map(([code, why]) => `    ${code}: {\n      why: '${why}',\n    },`)
  return extractCodes({ 'diagnostics.ts': `export const diagnostics = defineDiagnostics({\n  codes: {\n${entries.join('\n')}\n  },\n})\n` })
}

describe('extractCodes', () => {
  it('reads codes with their location from defineDiagnostics() sources only', () => {
    const codes = extractCodes({
      'a.ts': 'export const a = defineDiagnostics({\n  NUXT_B1001: { why: \'one\' },\n  NUXT_B1002: {\n    why: \'two\',\n  },\n})',
      'b.ts': 'const notACatalog = { NUXT_B1003: { why: \'three\' } }',
    })
    expect([...codes]).toStrictEqual([
      ['NUXT_B1001', { why: '\'one\' },', file: 'a.ts', line: 2 }],
      ['NUXT_B1002', { why: '\'two\',', file: 'a.ts', line: 3 }],
    ])
  })
})

describe('findDrift', () => {
  it('reports a code added with a different meaning on the other branch', () => {
    const drift = findDrift(catalog({}), catalog({ NUXT_B1001: 'new' }), catalog({ NUXT_B1001: 'old' }))
    expect(drift.map(d => [d.code, d.why, d.otherWhy])).toStrictEqual([['NUXT_B1001', '\'new\',', '\'old\',']])
  })

  it('reports a code reworded away from the other branch', () => {
    const drift = findDrift(catalog({ NUXT_B1001: 'old' }), catalog({ NUXT_B1001: 'new' }), catalog({ NUXT_B1001: 'old' }))
    expect(drift.map(d => d.code)).toStrictEqual(['NUXT_B1001'])
  })

  it('ignores drift that the change does not touch', () => {
    const base = catalog({ NUXT_B1001: 'here', NUXT_B1002: 'gone' })
    const head = catalog({ NUXT_B1001: 'here', NUXT_B1003: 'added' })
    const other = catalog({ NUXT_B1001: 'there', NUXT_B1002: 'kept', NUXT_B1004: 'only there' })
    expect(findDrift(base, head, other)).toStrictEqual([])
  })

  it('accepts codes added or reworded to match the other branch', () => {
    const base = catalog({ NUXT_B1002: 'old' })
    const head = catalog({ NUXT_B1001: 'ported', NUXT_B1002: 'ported too' })
    const other = catalog({ NUXT_B1001: 'ported', NUXT_B1002: 'ported too' })
    expect(findDrift(base, head, other)).toStrictEqual([])
  })
})

describe('readCodes', () => {
  it('reads the catalogs committed at a ref', () => {
    const codes = readCodes('HEAD')
    expect(codes.get('NUXT_B1001')).toMatchObject({ file: 'packages/kit/src/diagnostics/build.ts' })
  })
})
