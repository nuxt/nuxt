import type { Plugin } from 'rollup'
import { parse } from 'acorn'
import { walk } from 'estree-walker'
import type { Node } from 'estree-walker'
import MagicString from 'magic-string'
import tsBlankSpace from 'ts-blank-space'
import { fileURLToPath } from 'node:url'

declare global {

  var ___logged: boolean

  var ___timings: Record<string, number>

  var ___calls: Record<string, number>

  var ___callers: Record<string, number>

  var ____writeFileSync: typeof import('node:fs').writeFileSync
}

export function AnnotateFunctionTimingsPlugin (): Plugin {
  return {
    name: 'timings',
    transform: {
      order: 'post',
      handler (code, id) {
        const s = new MagicString(code)
        try {
          const ast = parse(tsBlankSpace(code), { sourceType: 'module', ecmaVersion: 'latest', locations: true })
          walk(ast as Node, {
            enter (node) {
              if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
                const functionName = node.id.name ? `${node.id.name} (${id.match(/[\\/]packages[\\/]([^/]+)[\\/]/)?.[1]})` : ''
                const start = (node.body as Node & { start: number, end: number }).start
                const end = (node.body as Node & { start: number, end: number }).end

                if (!functionName || ['createJiti', 'captureStackTrace', '___captureStackTrace', '_interopRequireDefault'].includes(functionName) || !start || !end) { return }

                s.prependLeft(start + 1, generateInitCode(functionName) + 'try {')
                s.appendRight(end - 1, `} finally { ${generateFinallyCode(functionName)} }`)
              }
            },
          })
          code = s.toString()
          if (!code.includes(leading)) {
            code = [leading, code, trailing].join('\n')
          }
          return code
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(e, code, id)
        }
      },
    },
  } satisfies Plugin
}

const metricsPath = fileURLToPath(new URL('../../debug-timings.json', import.meta.url))

// inlined from https://github.com/danielroe/errx
function captureStackTrace () {
  const IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[a-z]:[/\\]/i
  const LINE_RE = /^\s+at (?:(?<function>[^)]+) \()?(?<source>[^)]+)\)?$/u
  const SOURCE_RE = /^(?<source>.+):(?<line>\d+):(?<column>\d+)$/u

  if (!Error.captureStackTrace) {
    return []
  }
  // eslint-disable-next-line unicorn/error-message
  const stack = new Error()
  Error.captureStackTrace(stack)
  const trace = []
  for (const line of stack.stack?.split('\n') || []) {
    const parsed = LINE_RE.exec(line)?.groups
    if (!parsed) {
      continue
    }
    if (!parsed.source) {
      continue
    }
    const parsedSource = SOURCE_RE.exec(parsed.source)?.groups
    if (parsedSource) {
      Object.assign(parsed, parsedSource)
    }
    if (IS_ABSOLUTE_RE.test(parsed.source)) {
      parsed.source = `file://${parsed.source}`
    }
    if (parsed.source === import.meta.url) {
      continue
    }
    for (const key of ['line', 'column']) {
      // @ts-expect-error changing type from string to number
      parsed[key] &&= Number(parsed[key])
    }
    trace.push(parsed)
  }
  return trace
}

export const leading = `
import { writeFileSync as ____writeFileSync } from 'node:fs'
const ___captureStackTrace = ${captureStackTrace.toString()};
globalThis.___calls ||= {};
globalThis.___timings ||= {};
globalThis.___callers ||= {};`

function onExit () {
  if (globalThis.___logged) { return }
  globalThis.___logged = true

  ____writeFileSync(metricsPath, JSON.stringify(Object.fromEntries(Object.entries(globalThis.___timings).map(([name, time]) => [
    name,
    {
      time: Number(Number(time).toFixed(2)),
      calls: globalThis.___calls[name],
      callers: globalThis.___callers[name] ? Object.fromEntries(Object.entries(globalThis.___callers[name]).map(([name, count]) => [name.trim(), count]).sort((a, b) => typeof b[0] === 'string' && typeof a[0] === 'string' ? a[0].localeCompare(b[0]) : 0)) : undefined,
    },
  ]).sort((a, b) => typeof b[0] === 'string' && typeof a[0] === 'string' ? a[0].localeCompare(b[0]) : 0)), null, 2))

  // worst by total time
  const timings = Object.entries(globalThis.___timings)

  const topFunctionsTotalTime = timings
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, time]) => ({
      name,
      time: Number(Number(time).toFixed(2)),
      calls: globalThis.___calls[name],
      callers: globalThis.___callers[name] && Object.entries(globalThis.___callers[name]).map(([name, count]) => `${name.trim()} (${count})`).join(', '),
    }))

  // eslint-disable-next-line no-console
  console.log('Top 20 functions by total time:')
  // eslint-disable-next-line no-console
  console.table(topFunctionsTotalTime)

  // worst by average time (excluding single calls)
  const topFunctionsAverageTime = timings
    .filter(([name]) => (globalThis.___calls[name] || 0) > 1)
    .map(([name, time]) => [name, time / (globalThis.___calls[name] || 1)] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, time]) => ({
      name,
      time: Number(Number(time).toFixed(2)),
      calls: name && globalThis.___calls[name],
      callers: name && globalThis.___callers[name] && Object.entries(globalThis.___callers[name]).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name.trim()} (${count})`).join(', '),
    }))

  // eslint-disable-next-line no-console
  console.log('Top 20 functions by average time:')
  // eslint-disable-next-line no-console
  console.table(topFunctionsAverageTime)
}

export const trailing = `process.on("exit", ${onExit.toString().replace('metricsPath', JSON.stringify(metricsPath))})`

export function generateInitCode (functionName: string) {
  return `
  ___calls[${JSON.stringify(functionName)}] = (___calls[${JSON.stringify(functionName)}] || 0) + 1;
  ___timings[${JSON.stringify(functionName)}] ||= 0;
  const ___now = Date.now();`
}

export function generateFinallyCode (functionName: string) {
  return `
    ___timings[${JSON.stringify(functionName)}] += Date.now() - ___now;
    try {
      const ___callee = ___captureStackTrace()[1]?.function;
      if (___callee) {
        ___callers[${JSON.stringify(functionName)}] ||= {};
        ___callers[${JSON.stringify(functionName)}][' ' + ___callee] = (___callers[${JSON.stringify(functionName)}][' ' + ___callee] || 0) + 1;
      }
  } catch {}`
}
