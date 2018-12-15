import wrapAnsi from 'wrap-ansi'
import chalk from 'chalk'

export const startSpaces = 2
export const optionSpaces = 2

// 80% of terminal column width
export const maxCharsPerLine = (process.stdout.columns || 100) * 80 / 100

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

export function foldLines(string, spaces, firstLineSpaces, maxCharsPerLine) {
  return indentLines(wrapAnsi(string, maxCharsPerLine, { trim: false }), spaces, firstLineSpaces)
}

export function colorize(text) {
  return text
    .replace(/\[[^ ]+]/g, m => chalk.grey(m))
    .replace(/<[^ ]+>/g, m => chalk.green(m))
    .replace(/ (-[-\w,]+)/g, m => chalk.bold(m))
    .replace(/`(.+)`/g, (_, m) => chalk.bold.cyan(m))
}
