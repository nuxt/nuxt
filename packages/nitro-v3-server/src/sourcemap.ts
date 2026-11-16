import { decode, encode } from '@jridgewell/sourcemap-codec'
import type { SourceMapSegment } from '@jridgewell/sourcemap-codec'

export interface CodeEdit {
  start: number
  end: number
  content: string
}

/**
 * Apply non-overlapping edits that each replace a range within a single line,
 * shifting the generated positions of an encoded source map `mappings` string
 * to match. The code after a replaced range keeps the mapping active at its
 * end, and each line a replacement adds maps to the start of the range.
 */
export function applyEdits<T extends string | undefined> (code: string, mappings: T, edits: CodeEdit[]): { code: string, mappings: T } {
  const lineStarts = [0]
  for (let i = code.indexOf('\n'); i !== -1; i = code.indexOf('\n', i + 1)) {
    lineStarts.push(i + 1)
  }

  const sorted = [...edits].sort((a, b) => a.start - b.start)
  const editsByLine = new Map<number, CodeEdit[]>()
  let line = 0
  for (const edit of sorted) {
    while (line + 1 < lineStarts.length && lineStarts[line + 1]! <= edit.start) { line++ }
    const lineEdits = editsByLine.get(line)
    if (lineEdits) { lineEdits.push(edit) } else { editsByLine.set(line, [edit]) }
  }

  let result = ''
  let offset = 0
  for (const { start, end, content } of sorted) {
    result += code.slice(offset, start) + content
    offset = end
  }
  result += code.slice(offset)

  if (mappings === undefined) {
    return { code: result, mappings }
  }

  // Fields 1-4 are encoded relative to the previous segment, so dropping a
  // segment leaves a difference to fold into the next one that has each field.
  const carry = [0, 0, 0, 0]
  const out: string[] = []
  let lineStart = 0
  for (let index = 0; lineStart <= mappings.length; index++) {
    let lineEnd = mappings.indexOf(';', lineStart)
    if (lineEnd === -1) { lineEnd = mappings.length }
    const lineEdits = editsByLine.get(index)

    if (!lineEdits && !carry.some(Boolean)) {
      out.push(mappings.slice(lineStart, lineEnd))
    } else {
      const segments = decode(mappings.slice(lineStart, lineEnd))[0] ?? []
      const before = lastFields(segments)
      const lines = lineEdits ? editLine(segments, lineEdits, lineStarts[index]!, (lineStarts[index + 1] ?? code.length + 1) - 1) : [segments]
      for (const segments of lines) {
        for (const segment of segments) {
          for (let field = 1; field < segment.length; field++) {
            (segment as number[])[field]! += carry[field - 1]!
          }
        }
      }
      const after = lastFields(lines.flat())
      for (let field = 0; field < 4; field++) {
        carry[field]! += before[field]! - after[field]!
      }
      out.push(encode(lines))
    }

    lineStart = lineEnd + 1
  }

  return { code: result, mappings: out.join(';') as T }
}

function lastFields (segments: SourceMapSegment[]) {
  const last = [0, 0, 0, 0]
  for (const segment of segments) {
    for (let field = 1; field < segment.length; field++) {
      last[field - 1] = segment[field]!
    }
  }
  return last
}

function editLine (segments: SourceMapSegment[], edits: CodeEdit[], lineStart: number, lineEnd: number): SourceMapSegment[][] {
  const lines: SourceMapSegment[][] = []
  let current: SourceMapSegment[] = []
  let index = 0
  let shift = 0
  for (const { start, end, content } of edits) {
    const startCol = start - lineStart
    const endCol = end - lineStart
    for (; index < segments.length && segments[index]![0] <= startCol; index++) {
      current.push(shiftSegment(segments[index]!, shift))
    }
    let inner: SourceMapSegment | undefined
    for (; index < segments.length && segments[index]![0] < endCol; index++) {
      inner = segments[index]
    }

    const contentLines = content.split('\n')
    if (contentLines.length === 1) {
      shift += content.length - (end - start)
    } else {
      const covering = current.at(-1)
      const mapped = (): SourceMapSegment[] => covering && covering.length > 1 ? [[0, ...covering.slice(1)] as SourceMapSegment] : []
      lines.push(current, ...Array.from({ length: contentLines.length - 2 }, mapped))
      current = mapped()
      shift = contentLines[contentLines.length - 1]!.length - endCol
    }
    if (inner && end < lineEnd && segments[index]?.[0] !== endCol) {
      inner[0] = endCol
      current.push(shiftSegment(inner, shift))
    }
  }
  for (; index < segments.length; index++) {
    current.push(shiftSegment(segments[index]!, shift))
  }
  lines.push(current)
  return lines
}

function shiftSegment (segment: SourceMapSegment, shift: number): SourceMapSegment {
  if (shift) { segment[0] += shift }
  return segment
}
