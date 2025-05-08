// @ts-check

import { fileURLToPath } from 'node:url'

import { declare } from '@babel/helper-plugin-utils'
import { types as t } from '@babel/core'

const metricsPath = fileURLToPath(new URL('../../debug-timings.json', import.meta.url))

// inlined from https://github.com/danielroe/errx
function captureStackTrace () {
  const IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[a-z]:[/\\]/i
  const LINE_RE = /^\s+at (?:(?<function>[^)]+) \()?(?<source>[^)]+)\)?$/u
  const SOURCE_RE = /^(?<source>.+):(?<line>\d+):(?<column>\d+)$/u

  if (!Error.captureStackTrace) {
    return []
  }
  // oxlint-disable-next-line unicorn/error-message
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
      // @ts-expect-error
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

  // eslint-disable-next-line no-undef
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

  // oxlint-disable-next-line no-console
  console.log('Top 20 functions by total time:')
  // oxlint-disable-next-line no-console
  console.table(topFunctionsTotalTime)

  // worst by average time (excluding single calls)
  const topFunctionsAverageTime = timings
    .filter(([name]) => (globalThis.___calls[name] || 0) > 1)
    .map(([name, time]) => [name, time / (globalThis.___calls[name] || 1)])
    // @ts-expect-error
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, time]) => ({
      name,
      time: Number(Number(time).toFixed(2)),
      calls: name && globalThis.___calls[name],
      callers: name && globalThis.___callers[name] && Object.entries(globalThis.___callers[name]).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name.trim()} (${count})`).join(', '),
    }))

  // oxlint-disable-next-line no-console
  console.log('Top 20 functions by average time:')
  // oxlint-disable-next-line no-console
  console.table(topFunctionsAverageTime)
}

export const trailing = `process.on("exit", ${onExit.toString().replace('metricsPath', JSON.stringify(metricsPath))})`

/** @param {string} functionName */
export function generateInitCode (functionName) {
  return `
  ___calls[${JSON.stringify(functionName)}] = (___calls[${JSON.stringify(functionName)}] || 0) + 1;
  ___timings[${JSON.stringify(functionName)}] ||= 0;
  const ___now = Date.now();`
}

/** @param {string} functionName */
export function generateFinallyCode (functionName) {
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

export default declare((api) => {
  api.assertVersion(7)

  return {
    name: 'annotate-function-timings',
    visitor: {
      Program (path) {
        path.unshiftContainer('body', t.expressionStatement(t.identifier(leading)))
        path.pushContainer('body', t.expressionStatement(t.identifier(trailing)))
      },
      FunctionDeclaration (path) {
        const functionName = path.node.id?.name

        const start = path.get('body').get('body')[0]
        const end = path.get('body').get('body').pop()

        if (!functionName || ['createJiti', '___captureStackTrace', '_interopRequireDefault'].includes(functionName) || !start || !end) { return }

        const initCode = generateInitCode(functionName)
        const finallyCode = generateFinallyCode(functionName)

        const originalCode = path.get('body').get('body').map(statement => statement.node)
        path.get('body').get('body').forEach(statement => statement.remove())

        path.get('body').unshiftContainer('body', t.expressionStatement(t.identifier(initCode)))
        path.get('body').pushContainer('body', t.tryStatement(
          t.blockStatement(originalCode),
          t.catchClause(t.identifier('e'), t.blockStatement([])),
          t.blockStatement([t.expressionStatement(t.identifier(finallyCode))]),
        ))
      },
    },
  }
})
