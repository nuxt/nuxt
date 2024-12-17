import { describe, expect, it } from 'vitest'
import { parseAndWalk } from '../src/core/utils/parse'
import { TestScopeTracker } from './fixture/scope-tracker'

const filename = 'test.ts'

describe('scope tracker', () => {
  it('should throw away exited scopes', () => {
    const code = `
    const a = 1
    {
      const b = 2
    }
    `

    const scopeTracker = new TestScopeTracker()

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    expect(scopeTracker.getScopes().size).toBe(0)
  })

  it ('should keep exited scopes', () => {
    const code = `
    const a = 1
    {
      const b = 2
    }
    `

    const scopeTracker = new TestScopeTracker({ keepExitedScopes: true })

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    expect(scopeTracker.getScopes().size).toBe(2)
  })

  it('should generate scope key correctly and not allocate unnecessary scopes', () => {
    const code = `
    // starting in global scope ("")
    const a = 1
    // pushing scope for function parameters ("0")
    // pushing scope for function body ("0-0")
    function foo (param) {
      const b = 2
      // pushing scope for for loop variable declaration ("0-0-0")
      // pushing scope for for loop body ("0-0-0-0")
      for (let i = 0; i < 10; i++) {
        const c = 3

        // pushing scope for block statement ("0-0-0-0-0")
        try {
          const d = 4
        }
        // in for loop body scope ("0-0-0-0")
        // pushing scope for catch clause param ("0-0-0-0-1")
        // pushing scope for block statement ("0-0-0-0-1-0")
        catch (e) {
          const f = 4
        }

        // in for loop body scope ("0-0-0-0")

        const cc = 3
      }

      // in function body scope ("0-0")

      // pushing scope for for of loop variable declaration ("0-0-1")
      // pushing scope for for of loop body ("0-0-1-0")
      for (const i of [1, 2, 3]) {
        const dd = 3
      }

      // in function body scope ("0-0")

      // pushing scope for for in loop variable declaration ("0-0-2")
      // pushing scope for for in loop body ("0-0-2-0")
      for (const i in [1, 2, 3]) {
        const ddd = 3
      }

      // in function body scope ("0-0")

      // pushing scope for while loop body ("0-0-3")
      while (true) {
        const e = 3
      }
    }

    // in global scope ("")

    // pushing scope for function expression name ("1")
    // pushing scope for function parameters ("1-0")
    // pushing scope for function body ("1-0-0")
    const baz = function bar (param) {
      const g = 5

      // pushing scope for block statement ("1-0-0-0")
      if (true) {
        const h = 6
      }
    }

    // in global scope ("")

    // pushing scope for function expression name ("2")
    {
      const i = 7
      // pushing scope for block statement ("2-0")
      {
        const j = 8
      }
    }

    // in global scope ("")

    // pushing scope for arrow function parameters ("3")
    // pushing scope for arrow function body ("3-0")
    const arrow = (param) => {
      const k = 9
    }

    // in global scope ("")

    // pushing scope for class expression name ("4")
    const classExpression = class InternalClassName {
      classAttribute = 10
      // pushing scope for constructor function expression name ("4-0")
      // pushing scope for constructor parameters ("4-0-0")
      // pushing scope for constructor body ("4-0-0-0")
      constructor(constructorParam) {
        const l = 10
      }

      // in class body scope ("4")

      // pushing scope for static block ("4-1")
      static {
        const m = 11
      }
    }

    // in global scope ("")

    class NoScopePushedForThis {
      // pushing scope for constructor function expression name ("5")
      // pushing scope for constructor parameters ("5-0")
      // pushing scope for constructor body ("5-0-0")
      constructor() {
        const n = 12
      }
    }

    `

    const scopeTracker = new TestScopeTracker({
      keepExitedScopes: true,
    })

    // is in global scope initially
    expect(scopeTracker.getScopeIndexKey()).toBe('')

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    // is in global scope after parsing
    expect(scopeTracker.getScopeIndexKey()).toBe('')

    // check that the scopes are correct
    const scopes = scopeTracker.getScopes()

    const expectedScopesInOrder = [
      '',
      '0',
      '0-0',
      '0-0-0',
      '0-0-0-0',
      '0-0-0-0-0',
      '0-0-0-0-1',
      '0-0-0-0-1-0',
      '0-0-1',
      '0-0-1-0',
      '0-0-2',
      '0-0-2-0',
      '0-0-3',
      '1',
      '1-0',
      '1-0-0',
      '1-0-0-0',
      '2',
      '2-0',
      '3',
      '3-0',
      '4',
      // '4-0', -> DO NOT UNCOMMENT - class constructor method definition doesn't provide a function expression id (scope doesn't have any identifiers)
      '4-0-0',
      '4-0-0-0',
      '4-1',
      // '5',   -> DO NOT UNCOMMENT - class constructor - same as above
      // '5-0', -> DO NOT UNCOMMENT - class constructor parameters (none in this case, so the scope isn't stored)
      '5-0-0',
    ]

    expect(scopes.size).toBe(expectedScopesInOrder.length)

    const scopeKeys = Array.from(scopes.keys())

    expect(scopeKeys).toEqual(expectedScopesInOrder)
  })

  it ('should track variable declarations', () => {
    const code = `
    const a = 1

    {
      let b = 2
    }
    `

    const scopeTracker = new TestScopeTracker({
      keepExitedScopes: true,
    })

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    const scopes = scopeTracker.getScopes()

    const globalScope = scopes.get('')
    expect(globalScope?.get('a')?.type).toEqual('Variable')
    expect(globalScope?.get('b')).toBeUndefined()

    const blockScope = scopes.get('0')
    expect(blockScope?.get('b')?.type).toEqual('Variable')
    expect(blockScope?.get('a')).toBeUndefined()
  })

  it ('should separate variables in different scopes', () => {
    const code = `
    const a = 1

    {
      let a = 2
    }
    `

    const scopeTracker = new TestScopeTracker({
      keepExitedScopes: true,
    })

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    const scopes = scopeTracker.getScopes()

    const globalScope = scopes.get('')
    const globalA = globalScope?.get('a')
    expect(globalA?.type).toEqual('Variable')
    expect(globalA?.type === 'Variable' && globalA.variableNode.type).toEqual('VariableDeclaration')

    const blockScope = scopes.get('0')
    const blockA = blockScope?.get('a')
    expect(blockA?.type).toEqual('Variable')
    expect(blockA?.type === 'Variable' && blockA.variableNode.type).toEqual('VariableDeclaration')

    // check that the two `a` variables are different
    expect(globalA?.type === 'Variable' && globalA.variableNode).not.toBe(blockA?.type === 'Variable' && blockA.variableNode)
  })

  it ('should handle patterns', () => {
    const code = `
    const { a, b: c } = { a: 1, b: 2 }
    const [d, [e]] = [3, [4]]
    const { f: { g } } = { f: { g: 5 } }

    function foo ({ h, i: j }, [k, [l, m]]) {
    }
    `

    const scopeTracker = new TestScopeTracker({
      keepExitedScopes: true,
    })

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    const scopes = scopeTracker.getScopes()
    expect(scopes.size).toBe(2)

    const globalScope = scopes.get('')
    expect(globalScope?.size).toBe(6)

    expect(globalScope?.get('a')?.type).toEqual('Variable')
    expect(globalScope?.get('b')?.type).toBeUndefined()
    expect(globalScope?.get('c')?.type).toEqual('Variable')
    expect(globalScope?.get('d')?.type).toEqual('Variable')
    expect(globalScope?.get('e')?.type).toEqual('Variable')
    expect(globalScope?.get('f')?.type).toBeUndefined()
    expect(globalScope?.get('g')?.type).toEqual('Variable')
    expect(globalScope?.get('foo')?.type).toEqual('Function')

    const fooScope = scopes.get('0')
    expect(fooScope?.size).toBe(5)

    expect(fooScope?.get('h')?.type).toEqual('FunctionParam')
    expect(fooScope?.get('i')?.type).toBeUndefined()
    expect(fooScope?.get('j')?.type).toEqual('FunctionParam')
    expect(fooScope?.get('k')?.type).toEqual('FunctionParam')
    expect(fooScope?.get('l')?.type).toEqual('FunctionParam')
    expect(fooScope?.get('m')?.type).toEqual('FunctionParam')
  })
})
