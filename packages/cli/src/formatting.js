import wrapAnsi from 'wrap-ansi'

export const startSpaces = 2
export const optionSpaces = 2
export const maxCharsPerLine = 80

const terminalWidthPercentage = 80

export function indent(count, chr = ' ') {
  return chr.repeat(count)
}

export function indentLines(string, spaces, firstLineSpaces) {
  const lines = Array.isArray(string) ? string : string.split('\n')
  let s = ''
  if (lines.length) {
    const i0 = indent(firstLineSpaces === undefined ? spaces : firstLineSpaces)
    s = i0 + lines.shift()
  }
  if (lines.length) {
    const i = indent(spaces)
    s += '\n' + lines.map(l => i + l).join('\n')
  }
  return s
}

export function foldLines(string, spaces, firstLineSpaces) {
  const maxCharsPerLine = process.stdout.columns * terminalWidthPercentage / 100
  return indentLines(wrapAnsi(string, maxCharsPerLine, { trim: false }), spaces, firstLineSpaces)
}
