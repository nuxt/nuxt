import { walk as _walk } from 'estree-walker'
import type { Node, SyncHandler } from 'estree-walker'
import type { Program as ESTreeProgram } from 'estree'
import { parse } from 'acorn'
import type { Program } from 'acorn'

export type { Node }

type WithLocations<T> = T & { start: number, end: number }
type WalkerCallback = (this: ThisParameterType<SyncHandler>, node: WithLocations<Node>, parent: WithLocations<Node> | null, ctx: { key: string | number | symbol | null | undefined, index: number | null | undefined, ast: Program | Node }) => void

export function walk (ast: Program | Node, callback: { enter?: WalkerCallback, leave?: WalkerCallback }) {
  return _walk(ast as unknown as ESTreeProgram | Node, {
    enter (node, parent, key, index) {
      callback.enter?.call(this, node as WithLocations<Node>, parent as WithLocations<Node> | null, { key, index, ast })
    },
    leave (node, parent, key, index) {
      callback.leave?.call(this, node as WithLocations<Node>, parent as WithLocations<Node> | null, { key, index, ast })
    },
  }) as Program | Node | null
}

export function parseAndWalk (code: string, sourceFilename: string, callback: WalkerCallback): Program
export function parseAndWalk (code: string, sourceFilename: string, object: { enter?: WalkerCallback, leave?: WalkerCallback }): Program
export function parseAndWalk (code: string, _sourceFilename: string, callback: { enter?: WalkerCallback, leave?: WalkerCallback } | WalkerCallback) {
  const ast = parse (code, { sourceType: 'module', ecmaVersion: 'latest', locations: true })
  walk(ast, typeof callback === 'function' ? { enter: callback } : callback)
  return ast
}

export function withLocations<T> (node: T): WithLocations<T> {
  return node as WithLocations<T>
}
