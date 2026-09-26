import { describe, expect, it } from 'vitest'
import { generatedPosition, originalPosition, resolveSource, traceMapFor } from '../src/runtime/server/dev-error/sourcemap'

/** A map of `export function useBoom () {\n  throw new Error('boom')\n}` naming its own source. */
function mapOf (source: string) {
  return {
    version: 3,
    names: [],
    sources: [source],
    mappings: 'AAAA,gBAAgB,UAAW;AACzB,QAAM,IAAI,MAAM,MAAM;AACxB',
  }
}

describe('dev error sourcemaps', () => {
  it.each([
    ['a posix path', '/repo/app/utils/boom.ts', '/repo/app/utils/boom.ts'],
    ['a windows path', 'D:/repo/app/utils/boom.ts', 'D:/repo/app/utils/boom.ts'],
    ['a windows path with backslashes', 'D:\\repo\\app\\utils\\boom.ts', 'D:/repo/app/utils/boom.ts'],
  ])('resolves a source named by %s to the file it was mapped from', (_, file, expected) => {
    const trace = traceMapFor(mapOf(file.replaceAll('\\', '/')), file)

    expect(resolveSource(trace, file)).toBeDefined()
    expect(originalPosition(trace, 2, 3)?.file).toBe(expected)
  })

  it('maps a position both ways for a path led by a drive letter', () => {
    const file = 'D:/repo/app/utils/boom.ts'
    const trace = traceMapFor(mapOf(file), file)

    const original = originalPosition(trace, 2, 3)
    expect(original).toMatchObject({ file, line: 2 })
    expect(generatedPosition(trace, resolveSource(trace, file)!, original!.line)).toMatchObject({ line: 2 })
  })
})
