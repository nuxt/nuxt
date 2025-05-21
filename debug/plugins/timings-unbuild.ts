import type { Plugin } from 'rollup'
import { parse } from 'acorn'
import { type Node, walk } from 'estree-walker'
import MagicString from 'magic-string'
import tsBlankSpace from 'ts-blank-space'

import { generateFinallyCode, generateInitCode, leading, trailing } from './timings-babel.mjs'

declare global {
  // oxlint-disable-next-line no-var
  var ___logged: boolean
  // oxlint-disable-next-line no-var
  var ___timings: Record<string, number>
  // oxlint-disable-next-line no-var
  var ___calls: Record<string, number>
  // oxlint-disable-next-line no-var
  var ___callers: Record<string, number>
  // oxlint-disable-next-line no-var
  var ____writeFileSync: typeof import('fs').writeFileSync
}

export function AnnotateFunctionTimingsPlugin () {
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
          // oxlint-disable-next-line no-console
          console.log(e, code, id)
        }
      },
    },
  } satisfies Plugin
}
