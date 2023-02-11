import { pathToFileURL } from 'node:url'
import { parseURL } from 'ufo'
import MagicString from 'magic-string'
import { walk } from 'estree-walker'
import type { CallExpression, Property, Identifier, ImportDeclaration, MemberExpression, Literal, ReturnStatement, VariableDeclaration, ObjectExpression, Node, Pattern, AssignmentProperty } from 'estree'
import { createUnplugin } from 'unplugin'
import escapeStringRegexp from 'escape-string-regexp'
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
      const importDeclarations: AcornNode<ImportDeclaration>[] = []

      const [COMPONENTS_RE, COMPONENTS_IDENTIFIERS_RE] = regexpMap.get(components)!
      if (!COMPONENTS_RE.test(code)) { return }

      walk(this.parse(code, { sourceType: 'module', ecmaVersion: 'latest' }) as Node, {
        enter: (_node) => {
          const node = _node as AcornNode<CallExpression | ImportDeclaration>
          if (node.type === 'ImportDeclaration') {
            importDeclarations.push(node)
          } else if (
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
                  const componentsSet = new Set<string>()
                  s.remove(slot.start, slot.end + 1)
                  const removedCode = `({${code.slice(slot.start, slot.end + 1)}})`
                  const currentCode = s.toString()
                  walk(this.parse(removedCode, { sourceType: 'module', ecmaVersion: 'latest' }) as Node, {
                    enter: (_node) => {
                      const node = _node as AcornNode<CallExpression>
                      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && SSR_RENDER_RE.test(node.callee.name)) {
                        const componentNode = node.arguments[0]

                        if (componentNode.type === 'CallExpression') {
                          const identifier = componentNode.arguments[0] as Identifier
                          if (!isRenderedInCode(currentCode, removedCode.slice((componentNode as AcornNode<CallExpression>).start, (componentNode as AcornNode<CallExpression>).end))) { componentsSet.add(identifier.name) }
                        } else if (componentNode.type === 'Identifier' && !isRenderedInCode(currentCode, componentNode.name)) {
                          componentsSet.add(componentNode.name)
                        } else if (componentNode.type === 'MemberExpression') {
                          // expect componentNode to be a memberExpression (mostly used in dev with $setup[])
                          const { start, end } = componentNode as AcornNode<MemberExpression>
                          if (!isRenderedInCode(currentCode, removedCode.slice(start, end))) {
                            componentsSet.add(((componentNode as MemberExpression).property as Literal).value as string)
                            // remove the component from the return statement of `setup()`
                            walk(this.parse(code, { sourceType: 'module', ecmaVersion: 'latest' }) as Node, {
                              enter: (node) => {
                                removeFromSetupReturnStatement(s, node as Property, ((componentNode as MemberExpression).property as Literal).value as string)
                              }
                            })
                          }
                        }
                      }
                    }
                  })

                  const componentsToRemove = [...componentsSet]
                  const removedNode = new WeakSet<AcornNode<Node>>()

                  // remove variables
                  walk(this.parse(code, { sourceType: 'module', ecmaVersion: 'latest' }) as Node, {
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
                    removeImportDeclaration(importDeclarations, componentName, s)
                  }
                }
              }
            }
          }
        }
      })

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

function removeImportDeclaration (declarations: AcornNode<ImportDeclaration>[], importName: string, magicString: MagicString): boolean {
  // remove direct import
  const declaration = findImportDeclaration(declarations, importName)
  if (declaration) {
    if (declaration.specifiers.length > 1) {
      const componentSpecifier = declaration.specifiers.find(s => s.local.name === importName) as AcornNode<Identifier> | undefined

      if (componentSpecifier) { magicString.remove(componentSpecifier.start, componentSpecifier.end + 1) }
    } else {
      magicString.remove(declaration.start, declaration.end)
    }
    return true
  }
  return false
}

/**
 * find and return the importDeclaration that contain the import specifier
 *
 * @param {AcornNode<ImportDeclaration>[]} declarations - list of import declarations
 * @param {string} importName - name of the import
 */
function findImportDeclaration (declarations: AcornNode<ImportDeclaration>[], importName: string): AcornNode<ImportDeclaration> | undefined {
  const declaration = declarations.find((d) => {
    const specifier = d.specifiers.find(s => s.local.name === importName)
    if (specifier) { return true }
    return false
  })

  return declaration
}

/**
 * test if the name argument is used to render a component in the code
 *
 * @param code code to test
 * @param name component name
 */
function isRenderedInCode (code: string, name: string) {
  return new RegExp(`ssrRenderComponent\\(${escapeStringRegexp(name)}`).test(code)
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
