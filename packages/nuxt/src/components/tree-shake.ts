import { pathToFileURL } from 'node:url'
import { parseURL } from 'ufo'
import MagicString from 'magic-string'
import { walk } from 'estree-walker'
import type { CallExpression, Property, Identifier, MemberExpression, Literal, ReturnStatement, VariableDeclaration, ObjectExpression, Node, Pattern, AssignmentProperty, SpreadElement, Expression, Program } from 'estree'
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin'
import { createUnplugin } from 'unplugin'
import type { Component } from '@nuxt/schema'
import { resolve } from 'pathe'
import { distDir } from '../dirs'
import type { Component } from 'nuxt/schema'

interface TreeShakeTemplatePluginOptions {
  sourcemap?: boolean
  getComponents (): Component[]
}

type AcornNode<N extends Node> = N & { start: number, end: number }

const SSR_RENDER_RE = /ssrRenderComponent/
const PLACEHOLDER_EXACT_RE = /^(fallback|placeholder)$/
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
    transform (code, id) {
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
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier' &&
            SSR_RENDER_RE.test(node.callee.name)
          ) {
            const [componentCall, _, children] = node.arguments
            if (componentCall.type === 'Identifier' || componentCall.type === 'MemberExpression' || componentCall.type === 'CallExpression') {
              const componentName = getComponentName(node)
              const isClientComponent = COMPONENTS_IDENTIFIERS_RE.test(componentName)
              const isClientOnlyComponent = /^(?:_unref\()?(?:_component_)?(?:Lazy|lazy_)?(?:client_only|ClientOnly\)?)$/.test(componentName)
              if (isClientComponent && children?.type === 'ObjectExpression') {
                const slotsToRemove = isClientOnlyComponent ? children.properties.filter(prop => prop.type === 'Property' && prop.key.type === 'Identifier' && !PLACEHOLDER_EXACT_RE.test(prop.key.name)) as AcornNode<Property>[] : children.properties as AcornNode<Property>[]

                for (const slot of slotsToRemove) {
                  s.remove(slot.start, slot.end + 1)
                  const removedCode = `({${code.slice(slot.start, slot.end + 1)}})`
                  const currentCodeAst = this.parse(s.toString(), PARSER_OPTIONS) as Node

                  walk(this.parse(removedCode, PARSER_OPTIONS) as Node, {
                    enter: (_node) => {
                      const node = _node as AcornNode<CallExpression>
                      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && SSR_RENDER_RE.test(node.callee.name)) {
                        // detect if the component is called else where
                        const componentNode = node.arguments[0]

                        const nameToRemove = isComponentNotCalledInSetup.call(this, currentCodeAst, componentNode)
                        if (nameToRemove) {
                          componentsToRemoveSet.add(nameToRemove)
                          if (componentNode.type === 'MemberExpression') {
                            // remove the component from the return statement of `setup()`
                            walk(codeAst, {
                              enter: (node) => {
                                removeFromSetupReturnStatement(s, node as Property, ((componentNode as MemberExpression).property as Literal).value as string)
                              }
                            })
                          }
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
      const removedNode = new WeakSet<AcornNode<Node>>()

      // remove variables
      walk(codeAst, {
        enter (node) {
          if (node.type === 'VariableDeclaration') {
            for (const componentName of [...componentsToRemove]) {
              const hasBeenRemoved = removeVariableDeclarator(s, node as AcornNode<VariableDeclaration>, componentName, removedNode)

              if (hasBeenRemoved) {
                removedNode.add(hasBeenRemoved)
                const index = componentsToRemove.findIndex(c => c === componentName)
                componentsToRemove.splice(index, 1)
              }
            }
          }
        }
      })

      for (const componentName of componentsToRemove) {
        // remove import declaration if it exists
        removeImportDeclaration(codeAst, componentName, s)
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ source: id, includeContent: true })
            : undefined
        }
      }
    }
  }
})

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
function isComponentNotCalledInSetup (this: UnpluginBuildContext & UnpluginContext, codeAst: Node, ssrRenderExpression: Expression|SpreadElement): string|void {
  let name: string|undefined

  switch (ssrRenderExpression.type) {
    case 'CallExpression':
      // _unref(ClientOnly)
      name = (ssrRenderExpression.arguments[0] as Identifier).name
      break
    case 'MemberExpression':
      // $setup['ClientOnly']
      if (ssrRenderExpression.property.type === 'Literal') {
        name = ssrRenderExpression.property.value ? ssrRenderExpression.property.value.toString() : undefined
      }
      break
    case 'Identifier':
      // ClientOnly
      name = ssrRenderExpression.name
  }
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
 * remove a key from the return statement of the setup function
 */
function removeFromSetupReturnStatement (s: MagicString, node: Property, name: string) {
  if (node.type === 'Property' && node.key.type === 'Identifier' && node.key.name === 'setup' && node.value.type === 'FunctionExpression') {
    const returnStatement = node.value.body.body.find(n => n.type === 'ReturnStatement') as ReturnStatement | undefined
    if (returnStatement?.argument?.type === 'Identifier') {
      const returnIdentifier = returnStatement.argument.name
      const returnedDeclaration = node.value.body.body.find(n => n.type === 'VariableDeclaration' && (n.declarations[0].id as Identifier).name === returnIdentifier) as AcornNode<VariableDeclaration>
      const componentProperty = (returnedDeclaration?.declarations[0].init as ObjectExpression)?.properties.find(p => ((p as Property).key as Identifier).name === name) as AcornNode<Property>
      if (componentProperty) { s.remove(componentProperty.start, componentProperty.end + 1) }
    } else if (returnStatement?.argument?.type === 'ObjectExpression') {
      const componentProperty = returnStatement.argument?.properties.find(p => ((p as Property).key as Identifier).name === name) as AcornNode<Property>
      if (componentProperty) { s.remove(componentProperty.start, componentProperty.end + 1) }
    }
  }
}

/**
 * remove a variable declaration within the code
 */
function removeVariableDeclarator (code: MagicString, variableDeclaration: AcornNode<VariableDeclaration>, declarationName: string, removedNodeSet: WeakSet<Node>): AcornNode<Node> | undefined {
  for (const declarator of variableDeclaration.declarations) {
    const toRemove = findMatchingPatternToRemove(declarator.id as AcornNode<Pattern>, variableDeclaration, declarationName, removedNodeSet)
    if (toRemove) {
      code.remove(toRemove.start, toRemove.end + 1)
      return toRemove
    }
  }
}

function findMatchingPatternToRemove (node: AcornNode<Pattern>, toRemoveIfMatched: AcornNode<Node>, declarationName: string, removedNodeSet: WeakSet<Node>): AcornNode<Node> | undefined {
  if (node.type === 'Identifier') {
    if (node.name === declarationName) {
      return toRemoveIfMatched as AcornNode<Node>
    }
  } else if (node.type === 'ArrayPattern') {
    const elements = node.elements.filter((e): e is AcornNode<Pattern> => e !== null && !removedNodeSet.has(e))

    for (const element of elements) {
      const matched = findMatchingPatternToRemove(element, elements.length > 1 ? element : toRemoveIfMatched, declarationName, removedNodeSet)
      if (matched) { return matched }
    }
  } else if (node.type === 'ObjectPattern') {
    const properties = node.properties.filter((e): e is AssignmentProperty => e.type === 'Property' && !removedNodeSet.has(e))

    for (const [index, property] of properties.entries()) {
      let nodeToRemove = property as AcornNode<Node>
      if (properties.length < 2) {
        nodeToRemove = toRemoveIfMatched
      }

      const matched = findMatchingPatternToRemove(property.value as AcornNode<Pattern>, nodeToRemove as AcornNode<Node>, declarationName, removedNodeSet)
      if (matched) {
        if (matched === property) {
          properties.splice(index, 1)
        }
        return matched
      }
    }
  } else if (node.type === 'AssignmentPattern') {
    const matched = findMatchingPatternToRemove(node.left as AcornNode<Pattern>, toRemoveIfMatched, declarationName, removedNodeSet)
    if (matched) { return matched }
  }
}
