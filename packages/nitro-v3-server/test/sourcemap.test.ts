import { describe, expect, it } from 'vitest'
import { decode, encode } from '@jridgewell/sourcemap-codec'
import type { SourceMapSegment } from '@jridgewell/sourcemap-codec'
import { applyEdits } from '../src/sourcemap.ts'

function edit (code: string, target: string, content: string) {
  const start = code.indexOf(target)
  return { start, end: start + target.length, content }
}

describe('applyEdits', () => {
  const code = 'const a = "X", b = 1;\nfoo("X", bar);\nbaz();'
  const segments: SourceMapSegment[][] = [
    [[0, 0, 0, 0], [6, 0, 0, 6], [10, 0, 0, 10], [12, 0, 0, 14], [15, 0, 0, 18], [19, 0, 0, 22]],
    [[0, 0, 1, 0], [4, 0, 1, 4], [5, 0, 1, 5], [9, 0, 1, 9]],
    [[0, 0, 2, 0]],
  ]

  it('shifts segments after a single-line replacement', () => {
    const result = applyEdits(code, encode(segments), [edit(code, '"X"', '{x:1}')])
    expect(result.code).toBe('const a = {x:1}, b = 1;\nfoo("X", bar);\nbaz();')
    expect(decode(result.mappings)).toEqual([
      [[0, 0, 0, 0], [6, 0, 0, 6], [10, 0, 0, 10], [15, 0, 0, 14], [17, 0, 0, 18], [21, 0, 0, 22]],
      segments[1],
      segments[2],
    ])
  })

  it('maps the lines added by a multi-line replacement to the replaced position', () => {
    const target = edit(code, '("X"', '')
    const result = applyEdits(code, encode(segments), [{ start: target.start + 1, end: target.start + 4, content: '[\n1,\n22]' }])
    expect(result.code).toBe('const a = "X", b = 1;\nfoo([\n1,\n22], bar);\nbaz();')
    expect(decode(result.mappings)).toEqual([
      segments[0],
      [[0, 0, 1, 0], [4, 0, 1, 4]],
      [[0, 0, 1, 4]],
      [[0, 0, 1, 4], [3, 0, 1, 5], [5, 0, 1, 9]],
      segments[2],
    ])
  })

  it('applies several edits on one line', () => {
    const line = 'x("A","B",y)'
    const map = encode([[[0, 0, 0, 0], [2, 0, 0, 2], [6, 0, 0, 6], [10, 0, 0, 10]]])
    const result = applyEdits(line, map, [edit(line, '"A"', '1'), edit(line, '"B"', '22\n3')])
    expect(result.code).toBe('x(1,22\n3,y)')
    expect(decode(result.mappings)).toEqual([[[0, 0, 0, 0], [2, 0, 0, 2], [4, 0, 0, 6]], [[0, 0, 0, 6], [2, 0, 0, 10]]])
  })

  it('maps the code after a replaced range to the last segment inside it', () => {
    const source = 'a("XYZ");'
    const map = encode([[[0, 0, 0, 0], [3, 1, 5, 7, 2]]])
    const result = applyEdits(source, map, [edit(source, '"XYZ"', '1')])
    expect(result.code).toBe('a(1);')
    expect(decode(result.mappings)).toEqual([[[0, 0, 0, 0], [3, 1, 5, 7, 2]]])

    const bounded = applyEdits(source, encode([[[0, 0, 0, 0], [3, 1, 5, 7, 2], [7, 0, 0, 7]]]), [edit(source, '"XYZ"', '1')])
    expect(decode(bounded.mappings)).toEqual([[[0, 0, 0, 0], [3, 0, 0, 7]]])
  })

  it('keeps later lines intact when a replacement drops the last segment of a line', () => {
    const source = 'x = "XYZ"\nb();\nc();'
    const map: SourceMapSegment[][] = [
      [[0, 0, 0, 0], [6, 1, 5, 7, 2]],
      [[0], [1, 1, 6, 0]],
      [[0, 2, 1, 1, 3]],
    ]
    const result = applyEdits(source, encode(map), [edit(source, '"XYZ"', '1')])
    expect(result.code).toBe('x = 1\nb();\nc();')
    expect(decode(result.mappings)).toEqual([[[0, 0, 0, 0]], map[1], map[2]])
  })

  it('edits code without a map', () => {
    expect(applyEdits('a("X")', undefined, [edit('a("X")', '"X"', '1')])).toEqual({ code: 'a(1)', mappings: undefined })
  })
})
