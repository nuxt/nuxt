import { pathToFileURL } from 'node:url'
import { parseURL } from 'ufo'
import MagicString from 'magic-string'
import { walk } from 'estree-walker'
import type { AssignmentProperty, CallExpression, Identifier, Literal, MemberExpression, Node, ObjectExpression, Pattern, Program, Property, ReturnStatement, VariableDeclaration } from 'estree'
import { createUnplugin } from 'unplugin'
import type { Component } from '@nuxt/schema'
import { resolve } from 'pathe'
import { distDir } from '../dirs'

interface TreeShakeTemplatePluginOptions {
  sourcemap?: boolean
  getComponents (): Component[]
}

type AcornNode<N extends Node> = N & { start: number, end: number }

const SSR_RENDER_RE = /ssrRenderComponent/
const PLACEHOLDER_EXACT_RE = /^(fallback|placeholder)$/
const CLIENT_ONLY_NAME_RE = /^(?:_unref\()?(?:_component_)?(?:Lazy|lazy_)?(?:client_only|ClientOnly\)?)$/
const PARSER_OPTIONS = { sourceType: 'module', ecmaVersion: 'latest' }

export const TreeShakeTemplatePlugin = createUnplugin((options: TreeShakeTemplatePluginOptions) => {
  const regexpMap = new WeakMap<Component[], [RegExp, RegExp, string[]]>()
  return {
    name: 'nuxt:tree-shake-template',
    enforce: 'post',
    transformInclude (id) {
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return pathname.endsWith('.vue')
    },
    transform (code) {
      const components = options.getComponents()

      if (!regexpMap.has(components)) {
        const clientOnlyComponents = components
          .filter(c => c.mode === 'client' && !components.some(other => other.mode !== 'client' && other.pascalName === c.pascalName && other.filePath !== resolve(distDir, 'app/components/server-placeholder')))
          .flatMap(c => [c.pascalName, c.kebabName.replaceAll('-', '_')])
          .concat(['ClientOnly', 'client_only'])

        regexpMap.set(components, [new RegExp(`(${clientOnlyComponents.join('|')})`), new RegExp(`^(${clientOnlyComponents.map(c => `(?:(?:_unref\\()?(?:_component_)?(?:Lazy|lazy_)?${c}\\)?)`).join('|')})$`), clientOnlyComponents])
      }

      const s = new MagicString(code)

      const [COMPONENTS_RE, COMPONENTS_IDENTIFIERS_RE] = regexpMap.get(components)!
      if (!COMPONENTS_RE.test(code)) { return }

      const codeAst = this.parse(code, PARSER_OPTIONS) as AcornNode<Program>

      const componentsToRemoveSet = new Set<string>()

      // remove client only components or components called in ClientOnly default slot
      walk(codeAst, {
        enter: (_node) => {
          const node = _node as AcornNode<Node>
          if (isSsrRender(node)) {
            const [componentCall, _, children] = node.arguments
            if (componentCall.type === 'Identifier' || componentCall.type === 'MemberExpression' || componentCall.type === 'CallExpression') {
              const componentName = getComponentName(node)
              const isClientComponent = COMPONENTS_IDENTIFIERS_RE.test(componentName)
              const isClientOnlyComponent = CLIENT_ONLY_NAME_RE.test(componentName)

              if (isClientComponent && children?.type === 'ObjectExpression') {
                const slotsToRemove = isClientOnlyComponent ? children.properties.filter(prop => prop.type === 'Property' && prop.key.type === 'Identifier' && !PLACEHOLDER_EXACT_RE.test(prop.key.name)) as AcornNode<Property>[] : children.properties as AcornNode<Property>[]

                for (const slot of slotsToRemove) {
                  s.remove(slot.start, slot.end + 1)
                  const removedCode = `({${code.slice(slot.start, slot.end + 1)}})`
                  const currentCodeAst = this.parse(s.toString(), PARSER_OPTIONS) as Node

                  walk(this.parse(removedCode, PARSER_OPTIONS) as Node, {
                    enter: (_node) => {
                      const node = _node as AcornNode<CallExpression>
                      if (isSsrRender(node)) {
                        const name = getComponentName(node)

                        // detect if the component is called else where
                        const nameToRemove = isComponentNotCalledInSetup(currentCodeAst, name)
                        if (nameToRemove) {
                          componentsToRemoveSet.add(nameToRemove)
                        }
                      }
                    }
                  })
                }
              }
            }
          }
        }
      })

      const componentsToRemove = [...componentsToRemoveSet]
      const removedNodes = new WeakSet<AcornNode<Node>>()

      for (const componentName of componentsToRemove) {
        // remove import declaration if it exists
        removeImportDeclaration(codeAst, componentName, s)
        // remove variable declaration
        removeVariableDeclarator(codeAst, componentName, s, removedNodes)
        // remove from setup return statement
        removeFromSetupReturn(codeAst, componentName, s)
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})

/**
 * find and remove all property with the name parameter from the setup return statement and the __returned__ object
 */
function removeFromSetupReturn (codeAst: Program, name: string, magicString: MagicString) {
  let walkedInSetup = false
  walk(codeAst, {
    enter (node) {
      if (walkedInSetup) {
        this.skip()
      } else if (node.type === 'Property' && node.key.type === 'Identifier' && node.key.name === 'setup' && (node.value.type === 'FunctionExpression' || node.value.type === 'ArrowFunctionExpression')) {
        // walk into the setup function
        walkedInSetup = true
        if (node.value.body.type === 'BlockStatement') {
          const returnStatement = node.value.body.body.find(statement => statement.type === 'ReturnStatement') as ReturnStatement
          if (returnStatement && returnStatement.argument?.type === 'ObjectExpression') {
            // remove from return statement
            removePropertyFromObject(returnStatement.argument, name, magicString)
          }

          // remove from __returned__
          const variableList = node.value.body.body.filter((statement): statement is VariableDeclaration => statement.type === 'VariableDeclaration')
          const returnedVariableDeclaration = variableList.find(declaration => declaration.declarations[0]?.id.type === 'Identifier' && declaration.declarations[0]?.id.name === '__returned__' && declaration.declarations[0]?.init?.type === 'ObjectExpression')
          if (returnedVariableDeclaration) {
            const init = returnedVariableDeclaration.declarations[0].init as ObjectExpression
            removePropertyFromObject(init, name, magicString)
          }
        }
      }
    }
  })
}

/**
 * remove a property from an object expression
 */
function removePropertyFromObject (node: ObjectExpression, name: string, magicString: MagicString) {
  for (const property of node.properties) {
    if (property.type === 'Property' && property.key.type === 'Identifier' && property.key.name === name) {
      magicString.remove((property as AcornNode<Property>).start, (property as AcornNode<Property>).end + 1)
      return true
    }
  }
  return false
}

/**
 * is the node a call expression ssrRenderComponent()
 */
function isSsrRender (node: Node): node is AcornNode<CallExpression> {
  return node.type === 'CallExpression' && node.callee.type === 'Identifier' && SSR_RENDER_RE.test(node.callee.name)
}

function removeImportDeclaration (ast: Program, importName: string, magicString: MagicString): boolean {
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const specifier = node.specifiers.find(s => s.local.name === importName)
      if (specifier) {
        if (node.specifiers.length > 1) {
          const specifierIndex = node.specifiers.findIndex(s => s.local.name === importName)
          if (specifierIndex > -1) {
            magicString.remove((node.specifiers[specifierIndex] as AcornNode<Node>).start, (node.specifiers[specifierIndex] as AcornNode<Node>).end + 1)
            node.specifiers.splice(specifierIndex, 1)
          }
        } else {
          magicString.remove((node as AcornNode<Node>).start, (node as AcornNode<Node>).end)
        }
        return true
      }
    }
  }
  return false
}

/**
 * detect if the component is called else where
 * ImportDeclarations and VariableDeclarations are ignored
 * return the name of the component if is not called
 */
function isComponentNotCalledInSetup (codeAst: Node, name: string): string | void {
  if (name) {
    let found = false
    walk(codeAst, {
      enter (node) {
        if ((node.type === 'Property' && node.key.type === 'Identifier' && node.value.type === 'FunctionExpression' && node.key.name === 'setup') || (node.type === 'FunctionDeclaration' && node.id?.name === '_sfc_ssrRender')) {
          // walk through the setup function node or the ssrRender function
          walk(node, {
            enter (node) {
              if (found || node.type === 'VariableDeclaration') {
                this.skip()
              } else if (node.type === 'Identifier' && node.name === name) {
                found = true
              } else if (node.type === 'MemberExpression') {
                // dev only with $setup or _ctx
                found = (node.property.type === 'Literal' && node.property.value === name) || (node.property.type === 'Identifier' && node.property.name === name)
              }
            }
          })
        }
      }
    })
    if (!found) { return name }
  }
}

/**
 * retrieve the component identifier being used on ssrRender callExpression
 *
 * @param {CallExpression} ssrRenderNode - ssrRender callExpression
 */
function getComponentName (ssrRenderNode: AcornNode<CallExpression>): string {
  const componentCall = ssrRenderNode.arguments[0] as Identifier | MemberExpression | CallExpression

  if (componentCall.type === 'Identifier') {
    return componentCall.name
  } else if (componentCall.type === 'MemberExpression') {
    return (componentCall.property as Literal).value as string
  }
  return (componentCall.arguments[0] as Identifier).name
}

/**
 * remove a variable declaration within the code
 */
function removeVariableDeclarator (codeAst: Node, name: string, magicString: MagicString, removedNodes: WeakSet<Node>): AcornNode<Node> | void {
  // remove variables
  walk(codeAst, {
    enter (node) {
      if (node.type === 'VariableDeclaration') {
        for (const declarator of node.declarations) {
          const toRemove = findMatchingPatternToRemove(declarator.id as AcornNode<Pattern>, node as AcornNode<VariableDeclaration>, name, removedNodes)
          if (toRemove) {
            magicString.remove(toRemove.start, toRemove.end + 1)
            removedNodes.add(toRemove)
            return toRemove
          }
        }
      }
    }
  })
}

/**
 * find the Pattern to remove which the identifier is equal to the name parameter.
 */
function findMatchingPatternToRemove (node: AcornNode<Pattern>, toRemoveIfMatched: AcornNode<Node>, name: string, removedNodeSet: WeakSet<Node>): AcornNode<Node> | undefined {
  if (node.type === 'Identifier') {
    if (node.name === name) {
      return toRemoveIfMatched
    }
  } else if (node.type === 'ArrayPattern') {
    const elements = node.elements.filter((e): e is AcornNode<Pattern> => e !== null && !removedNodeSet.has(e))

    for (const element of elements) {
      const matched = findMatchingPatternToRemove(element, elements.length > 1 ? element : toRemoveIfMatched, name, removedNodeSet)
      if (matched) { return matched }
    }
  } else if (node.type === 'ObjectPattern') {
    const properties = node.properties.filter((e): e is AssignmentProperty => e.type === 'Property' && !removedNodeSet.has(e))

    for (const [index, property] of properties.entries()) {
      let nodeToRemove = property as AcornNode<Node>
      if (properties.length < 2) {
        nodeToRemove = toRemoveIfMatched
      }

      const matched = findMatchingPatternToRemove(property.value as AcornNode<Pattern>, nodeToRemove as AcornNode<Node>, name, removedNodeSet)
      if (matched) {
        if (matched === property) {
          properties.splice(index, 1)
        }
        return matched
      }
    }
  } else if (node.type === 'AssignmentPattern') {
    const matched = findMatchingPatternToRemove(node.left as AcornNode<Pattern>, toRemoveIfMatched, name, removedNodeSet)
    if (matched) { return matched }
  }
}
