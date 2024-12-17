import { describe, expect, it } from 'vitest'
import { getUndeclaredIdentifiersInFunction, parseAndWalk } from '../src/core/utils/parse'
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
    let x, y = 2

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
    expect(globalScope?.get('x')?.type).toEqual('Variable')
    expect(globalScope?.get('y')?.type).toEqual('Variable')

    const blockScope = scopes.get('0')
    expect(blockScope?.get('b')?.type).toEqual('Variable')
    expect(blockScope?.get('a')).toBeUndefined()
    expect(blockScope?.get('x')).toBeUndefined()
    expect(blockScope?.get('y')).toBeUndefined()

    expect(scopeTracker.isDeclaredInScope('a', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('a', '0')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('y', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('y', '0')).toBe(true)

    expect(scopeTracker.isDeclaredInScope('b', '')).toBe(false)
    expect(scopeTracker.isDeclaredInScope('b', '0')).toBe(true)
  })

  it ('should separate variables in different scopes', () => {
    const code = `
    const a = 1

    {
      let a = 2
    }

    function foo (a) {
      // scope "1-0"
      let b = a
    }
    `

    const scopeTracker = new TestScopeTracker({
      keepExitedScopes: true,
    })

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    const globalA = scopeTracker.getDeclarationFromScope('a', '')
    expect(globalA?.type).toEqual('Variable')
    expect(globalA?.type === 'Variable' && globalA.variableNode.type).toEqual('VariableDeclaration')

    const blockA = scopeTracker.getDeclarationFromScope('a', '0')
    expect(blockA?.type).toEqual('Variable')
    expect(blockA?.type === 'Variable' && blockA.variableNode.type).toEqual('VariableDeclaration')

    // check that the two `a` variables are different
    expect(globalA?.type === 'Variable' && globalA.variableNode).not.toBe(blockA?.type === 'Variable' && blockA.variableNode)

    // check that the `a` in the function scope is a function param and not a variable
    const fooA = scopeTracker.getDeclarationFromScope('a', '1-0')
    expect(fooA?.type).toEqual('FunctionParam')
  })

  it ('should handle patterns', () => {
    const code = `
    const { a, b: c } = { a: 1, b: 2 }
    const [d, [e]] = [3, [4]]
    const { f: { g } } = { f: { g: 5 } }

    function foo ({ h, i: j } = {}, [k, [l, m]]) {
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

    expect(scopeTracker.isDeclaredInScope('a', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('b', '')).toBe(false)
    expect(scopeTracker.isDeclaredInScope('c', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('d', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('e', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('f', '')).toBe(false)
    expect(scopeTracker.isDeclaredInScope('g', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('h', '0')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('i', '0')).toBe(false)
    expect(scopeTracker.isDeclaredInScope('j', '0')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('k', '0')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('l', '0')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('m', '0')).toBe(true)
  })

  it ('should handle imports', () => {
    const code = `
    import { a, b as c } from 'module-a'
    import d from 'module-b'
    `

    const scopeTracker = new TestScopeTracker({
      keepExitedScopes: true,
    })

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    expect(scopeTracker.isDeclaredInScope('a', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('b', '')).toBe(false)
    expect(scopeTracker.isDeclaredInScope('c', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('d', '')).toBe(true)

    expect(scopeTracker.getScopes().get('')?.size).toBe(3)
  })

  it ('should freeze scopes', () => {
    let code = `
    const a = 1
    {
      const b = 2
    }
    `

    const scopeTracker = new TestScopeTracker({
      keepExitedScopes: true,
    })

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    expect(scopeTracker.getScopes().size).toBe(2)

    code = code + '\n' + `
      {
        const c = 3
      }
    `

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    expect(scopeTracker.getScopes().size).toBe(3)

    scopeTracker.freeze()

    code = code + '\n' + `
      {
        const d = 4
      }
    `

    parseAndWalk(code, filename, {
      scopeTracker,
    })

    expect(scopeTracker.getScopes().size).toBe(3)

    expect(scopeTracker.isDeclaredInScope('a', '')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('b', '0')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('c', '1')).toBe(true)
    expect(scopeTracker.isDeclaredInScope('d', '2')).toBe(false)
  })
})

describe('parsing', () => {
  it ('should correctly get identifiers not declared in a function', () => {
    const functionParams = `(param, { param1, temp: param2 } = {}, [param3, [param4]])`
    const functionBody = `{
      const c = 1, d = 2
      console.log(undeclaredIdentifier1, foo)
      const obj = {
        key1: param,
        key2: undeclaredIdentifier1,
        undeclaredIdentifier2: undeclaredIdentifier2,
        undeclaredIdentifier3,
        undeclaredIdentifier4,
      }
      nonExistentFunction()

      console.log(a, b, c, d, param, param1, param2, param3, param4, param['test']['key'])
      console.log(param3[0].access['someKey'], obj, obj.key1, obj.key2, obj.undeclaredIdentifier2, obj.undeclaredIdentifier3)

      try {} catch (error) { console.log(error) }

      class Foo { constructor() { console.log(Foo) } }
      const cls = class Bar { constructor() { console.log(Bar, cls) } }
      const cls2 = class Baz {
        someProperty = someValue
        someMethod() { }
      }
      console.log(Baz)

      function f() {
        console.log(hoisted, nonHoisted)
      }
      let hoisted = 1
      f()
    }`

    const code = `
    import { a } from 'module-a'
    const b = 1

    // "0"
    function foo ${functionParams} ${functionBody}

    // "1"
    const f = ${functionParams} => ${functionBody}

    // "2-0"
    const bar = function ${functionParams} ${functionBody}

    // "3-0"
    const baz = function foo ${functionParams} ${functionBody}
    `

    const scopeTracker = new TestScopeTracker({
      keepExitedScopes: true,
    })

    let processedFunctions = 0

    parseAndWalk(code, filename, {
      scopeTracker,
      enter: (node) => {
        if ((node.type !== 'FunctionDeclaration' && node.type !== 'FunctionExpression' && node.type !== 'ArrowFunctionExpression') || !['0', '1', '2-0', '3-0'].includes(scopeTracker.getScopeIndexKey())) { return }

        const undeclaredIdentifiers = getUndeclaredIdentifiersInFunction(node)
        expect(undeclaredIdentifiers).toEqual([
          'console',
          'undeclaredIdentifier1',
          ...(node.type === 'ArrowFunctionExpression' || (node.type === 'FunctionExpression' && !node.id) ? ['foo'] : []),
          'undeclaredIdentifier2',
          'undeclaredIdentifier3',
          'undeclaredIdentifier4',
          'nonExistentFunction',
          'a', // import is outside the scope of the function
          'b', // variable is outside the scope of the function
          'someValue',
          'Baz',
          'nonHoisted',
        ])

        processedFunctions++
      },
    })

    expect(processedFunctions).toBe(4)
  })
})
