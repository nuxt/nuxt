import { Buffer } from 'node:buffer'
import { camelize, capitalize } from '@vue/shared'
import { hash } from 'ohash'
import { isAbsolute, relative, resolve } from 'pathe'
import { pascalCase } from 'scule'
import type { AttributeNode, ConstantTypes, DirectiveNode, ElementNode, ElementTypes, NodeTransform, NodeTypes, ParentNode, RootNode, SimpleExpressionNode, TemplateChildNode, TransformContext } from '@vue/compiler-core'

import { tryUseNuxt } from '@nuxt/kit'
import { componentDiagnostics } from '@nuxt/kit/internal'
import { installNuxtModule } from '../core/features.ts'
import { linkToAlias } from '../utils.ts'
import type { Component, ComponentsOptions } from 'nuxt/schema'

type Mode = 'client' | 'server'

const NODE_ROOT = 0 as NodeTypes.ROOT
const NODE_ELEMENT = 1 as NodeTypes.ELEMENT
const NODE_SIMPLE_EXPRESSION = 4 as NodeTypes.SIMPLE_EXPRESSION
const NODE_ATTRIBUTE = 6 as NodeTypes.ATTRIBUTE
const NODE_DIRECTIVE = 7 as NodeTypes.DIRECTIVE
const NODE_IF_BRANCH = 10 as NodeTypes.IF_BRANCH
const NODE_FOR = 11 as NodeTypes.FOR
const ELEMENT_COMPONENT = 1 as ElementTypes.COMPONENT
const ELEMENT_TEMPLATE = 3 as ElementTypes.TEMPLATE

type Strategy = 'Idle' | 'Visible' | 'Interaction' | 'MediaQuery' | 'If' | 'Never' | 'Time'

const HYDRATION_PROPS: Record<string, Strategy> = {
  hydrateOnIdle: 'Idle',
  hydrateOnVisible: 'Visible',
  hydrateOnInteraction: 'Interaction',
  hydrateOnMediaQuery: 'MediaQuery',
  hydrateAfter: 'Time',
  hydrateWhen: 'If',
  hydrateNever: 'Never',
}

const LAZY_PREFIX_RE = /^(?:lazy-|Lazy(?=[A-Z]))/
const STRATEGY_PREFIX_RE = /^(?:(Idle|Visible|Interaction|MediaQuery|If|Never|Time)(?=[A-Z])|(idle|visible|interaction|media-query|if|never|time)-)/
const STRATEGY_SUFFIX_RE = /__(Idle|Visible|Interaction|MediaQuery|If|Never|Time)$/
const CLIENT_ONLY_RE = /^(?:ClientOnly|client-only)$/
const PLACEHOLDER_SLOT_RE = /^(?:fallback|placeholder)$/
const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const UNSAFE_SPECIFIER_RE = /['\n\r\\]/

const CORE_COMPONENTS = new Set(['Teleport', 'teleport', 'Suspense', 'suspense', 'KeepAlive', 'keep-alive', 'BaseTransition', 'base-transition'])
const SETUP_REFERENCE_TYPES = new Set(['setup-const', 'setup-reactive-const', 'literal-const', 'setup-let', 'setup-ref', 'setup-maybe-ref'])

export const COMPONENT_WRAPPER_PREFIX = '/virtual:nuxt-component:'

export interface ComponentResolverOptions {
  getComponents (): Component[]
  rootDir: string
  serverPlaceholderPath: string
  lazyHydration?: boolean
  experimentalComponentIslands?: boolean
  transform?: ComponentsOptions['transform']
  /** Record the tags used by each template so that dependent modules can be invalidated when components change. */
  trackResolutions?: boolean
}

export type ComponentWrapperKind = 'server' | 'client' | 'lazy' | `lazy-${Strategy}`

const WRAPPER_KINDS = new Set<string>(['server', 'client', 'lazy', 'lazy-Idle', 'lazy-Visible', 'lazy-Interaction', 'lazy-MediaQuery', 'lazy-If', 'lazy-Never', 'lazy-Time'])
const RELATIVE_PATH_RE = /^\.{1,2}\//

export interface ComponentWrapper {
  kind: ComponentWrapperKind
  component: Pick<Component, 'pascalName' | 'filePath' | 'export'>
  /** Wrap the lazily loaded component with `createClientOnly`. */
  clientOnly?: boolean
}

export interface ComponentImport {
  source: string
  importName: string
  component: Component
}

interface ComponentIndex {
  byName: Map<string, Component[]>
  clientOnly: Set<string>
}

interface CompileState {
  root: RootNode
  index: ComponentIndex
  mode: Mode
  filename: string
  excluded: boolean
  /** Asset id for each tag resolved by this compilation, or `null` when the tag is left for Vue to resolve at runtime. */
  tags: Map<string, string | null>
  imported: Set<string>
  records: Map<string, string | undefined>
  warned: Set<number>
  pruned: Set<string>
}

export interface ComponentResolver {
  nodeTransform: NodeTransform
  /** Decode the wrapper described by a module id. */
  getWrapper (id: string): ComponentWrapper | undefined
  resolveTag (tag: string, mode: Mode, importer: string): ComponentImport | undefined
  /** Tags referenced by each compiled template, keyed by mode and module id, with a key identifying what each tag resolved to. */
  resolutions: Record<Mode, Map<string, Map<string, string | undefined>>>
  resolutionKey (resolution: ComponentImport | undefined): string | undefined
  /** `<script setup>` bindings used as tags in subtrees omitted from the server build, keyed by file. */
  prunedBindings: Map<string, Set<string>>
}

export function createComponentResolver (options: ComponentResolverOptions): ComponentResolver {
  const nuxt = tryUseNuxt()
  const exclude = options.transform?.exclude || []
  const indexes = new WeakMap<Component[], ComponentIndex>()
  const states = new WeakMap<object, CompileState>()
  const resolutions: ComponentResolver['resolutions'] = { client: new Map(), server: new Map() }
  const prunedBindings = new Map<string, Set<string>>()

  function getIndex (): ComponentIndex {
    const components = options.getComponents()
    let index = indexes.get(components)
    if (!index) {
      const byName = new Map<string, Component[]>()
      for (const component of components) {
        const list = byName.get(component.pascalName)
        if (list) {
          list.push(component)
        } else {
          byName.set(component.pascalName, [component])
        }
      }
      const clientOnly = new Set<string>()
      for (const [name, list] of byName) {
        if (list.some(c => c.mode === 'client') && !list.some(c => c.mode !== 'client' && c.filePath !== options.serverPlaceholderPath)) {
          clientOnly.add(name)
        }
      }
      index = { byName, clientOnly }
      indexes.set(components, index)
    }
    return index
  }

  function findComponent (index: ComponentIndex, name: string, mode: Mode) {
    const list = index.byName.get(toPascalName(name))
    if (!list) { return }
    const component = list.find(c => c.mode === 'all' || c.mode === mode || c.mode === undefined)
    if (component) { return component }
    if (mode === 'server') {
      return index.byName.get('ServerPlaceholder')?.[0]
    }
    return list[0]
  }

  function wrapperId (wrapper: ComponentWrapper, importer: string) {
    const { component } = wrapper
    const filePath = isAbsolute(component.filePath) ? toRelativePath(relative(options.rootDir, component.filePath)) : component.filePath
    const payload = Buffer.from(JSON.stringify([wrapper.kind, component.pascalName, filePath, component.export ?? 'default', !!wrapper.clientOnly])).toString('base64url')
    const key = hash([relative(options.rootDir, importer), payload]).slice(0, 10)
    return `${COMPONENT_WRAPPER_PREFIX}${wrapper.kind}:${component.pascalName}:${key}:${payload}`
  }

  function getWrapper (id: string): ComponentWrapper | undefined {
    if (!id.startsWith(COMPONENT_WRAPPER_PREFIX)) { return }
    try {
      const [kind, pascalName, filePath, exportName, clientOnly] = JSON.parse(Buffer.from(id.slice(id.lastIndexOf(':') + 1), 'base64url').toString())
      if (!WRAPPER_KINDS.has(kind) || typeof pascalName !== 'string' || typeof filePath !== 'string' || typeof exportName !== 'string') { return }
      return {
        kind,
        component: { pascalName, filePath: RELATIVE_PATH_RE.test(filePath) ? resolve(options.rootDir, filePath) : filePath, export: exportName },
        clientOnly: clientOnly === true,
      }
    } catch {
      return undefined
    }
  }

  function resolveTag (tag: string, mode: Mode, importer: string, index = getIndex()): ComponentImport | undefined {
    for (const candidate of parseTag(tag)) {
      const component = findComponent(index, candidate.name, mode)
      if (!component) { continue }
      if (UNSAFE_SPECIFIER_RE.test(component.filePath)) { return }

      const hasClientVariant = index.byName.get(component.pascalName)!.some(c => c.mode === 'client')
      if (!component._raw && component.mode === 'server' && !hasClientVariant) {
        return { source: wrapperId({ kind: 'server', component }, importer), importName: 'default', component }
      }

      const isClientOnly = !component._raw && component.mode === 'client'
      if (candidate.lazy) {
        const kind: ComponentWrapperKind = candidate.strategy ? `lazy-${candidate.strategy}` : 'lazy'
        return { source: wrapperId({ kind, component, clientOnly: !candidate.strategy && isClientOnly }, importer), importName: 'default', component }
      }
      if (isClientOnly) {
        return { source: wrapperId({ kind: 'client', component }, importer), importName: 'default', component }
      }
      return { source: component.filePath, importName: component._raw ? 'default' : (component.export ?? 'default'), component }
    }
  }

  function resolutionKey (resolution: ComponentImport | undefined) {
    return resolution && `${resolution.source}#${resolution.importName}`
  }

  function onResolved (resolution: ComponentImport, state: CompileState) {
    const { component } = resolution
    const internalInstall = (component as { _internal_install?: string })._internal_install
    if (internalInstall && nuxt?.options.test === false) {
      if (!nuxt.options.dev) {
        throw componentDiagnostics.NUXT_B3004({ file: linkToAlias(state.filename, nuxt), component: component.pascalName, requiredModule: internalInstall })
      }
      installNuxtModule(internalInstall)
    }
    if (!options.experimentalComponentIslands && resolution.source.startsWith(COMPONENT_WRAPPER_PREFIX + 'server:')) {
      componentDiagnostics.NUXT_B3003({ component: component.pascalName })
    }
  }

  function isExcluded (filename: string) {
    return exclude.some(pattern => pattern.test(filename))
  }

  function createState (root: RootNode, context: TransformContext): CompileState {
    return {
      root,
      index: getIndex(),
      mode: context.inSSR ? 'server' : 'client',
      filename: context.filename,
      excluded: !!context.filename && isExcluded(context.filename),
      tags: new Map(),
      imported: new Set(),
      records: new Map(),
      warned: new Set(),
      pruned: new Set(),
    }
  }

  function renameHydratedChildren (parent: ParentNode, context: TransformContext, state: CompileState) {
    for (const child of parent.children) {
      if (child.type !== NODE_ELEMENT || child.tagType !== ELEMENT_COMPONENT) { continue }
      const lazy = LAZY_PREFIX_RE.exec(child.tag)?.[0]
      const name = lazy ? child.tag.slice(lazy.length) : child.tag
      if (!state.index.byName.has(toPascalName(name)) || getSetupBinding(child.tag, context)) { continue }

      const warn = !state.warned.has(child.loc.start.offset)
      state.warned.add(child.loc.start.offset)

      let strategy: Strategy | undefined
      for (const prop of child.props) {
        const propStrategy = HYDRATION_PROPS[camelize(getPropName(prop) || '')]
        if (!propStrategy) { continue }
        if (strategy) {
          if (warn) {
            componentDiagnostics.NUXT_B3005({ component: child.tag, file: linkToAlias(state.filename, nuxt, child.loc.start) })
          }
        } else {
          strategy = propStrategy
        }
      }
      if (!strategy) { continue }

      if (!lazy) {
        if (warn && (nuxt?.options.dev || nuxt?.options.test)) {
          componentDiagnostics.NUXT_B3006({ component: child.tag, file: linkToAlias(state.filename, nuxt, child.loc.start), lazyName: `Lazy${pascalCase(child.tag)}` })
        }
        continue
      }
      child.tag = `${child.tag}__${strategy}`
    }
  }

  function pruneClientOnlyChildren (parent: ParentNode, context: TransformContext, state: CompileState) {
    for (const child of parent.children) {
      if (child.type !== NODE_ELEMENT || child.tagType !== ELEMENT_COMPONENT || !child.children.length) { continue }
      const name = getBaseName(child.tag)
      const isClientOnly = CLIENT_ONLY_RE.test(name)
      if (!isClientOnly && !state.index.clientOnly.has(toPascalName(name))) { continue }
      const kept: TemplateChildNode[] = []
      for (const node of child.children) {
        if (isClientOnly && isPlaceholderSlot(node)) {
          kept.push(node)
        } else {
          collectSetupBindings(node, context, state.pruned)
        }
      }
      child.children = kept
    }
  }

  function resolveElement (node: ElementNode, context: TransformContext, state: CompileState) {
    if (node.tag === 'component' || node.tag === 'Component') { return }
    const tag = getVueIsTag(node) ?? node.tag
    if (state.tags.has(tag)) { return }
    if (tag.includes('.') || CORE_COMPONENTS.has(tag) || context.isBuiltInComponent(tag) || getSetupBinding(tag, context)) {
      state.tags.set(tag, null)
      return
    }

    const resolution = resolveTag(tag, state.mode, state.filename, state.index)
    if (options.trackResolutions) {
      state.records.set(tag, resolutionKey(resolution))
    }
    if (!resolution) {
      state.tags.set(tag, null)
      return
    }

    onResolved(resolution, state)
    const assetId = toValidAssetId(tag)
    state.tags.set(tag, assetId)
    if (!state.imported.has(assetId)) {
      state.imported.add(assetId)
      emitImport(context, assetId, resolution)
    }
  }

  function finalize (context: TransformContext, state: CompileState) {
    for (const [tag, assetId] of state.tags) {
      if (assetId) {
        context.components.delete(tag)
        context.components.delete(tag + '__self')
      }
    }
    if (!context.components.size) {
      removeResolveComponentHelper(context)
    }
  }

  const nodeTransform: NodeTransform = (node, context) => {
    if (!context.imports || !context.components) { return }

    let state = states.get(context.imports)
    if (!state) {
      if (node.type !== NODE_ROOT) { return }
      state = createState(node, context)
      states.set(context.imports, state)
    }

    if (node.type === NODE_ROOT || node.type === NODE_ELEMENT || node.type === NODE_IF_BRANCH || node.type === NODE_FOR) {
      if (options.lazyHydration && !state.excluded) {
        renameHydratedChildren(node, context, state)
      }
      if (state.mode === 'server') {
        pruneClientOnlyChildren(node, context, state)
      }
    }

    if (node.type === NODE_ELEMENT && node.tagType === ELEMENT_COMPONENT && !state.excluded) {
      resolveElement(node, context, state)
      return
    }

    if (node.type === NODE_ROOT) {
      const currentState = state
      return () => {
        finalize(context, currentState)
        if (node !== currentState.root || !currentState.filename) { return }
        if (options.trackResolutions) {
          if (currentState.records.size) {
            resolutions[currentState.mode].set(currentState.filename, currentState.records)
          } else {
            resolutions[currentState.mode].delete(currentState.filename)
          }
        }
        if (currentState.mode === 'server') {
          if (currentState.pruned.size) {
            prunedBindings.set(currentState.filename, currentState.pruned)
          } else {
            prunedBindings.delete(currentState.filename)
          }
        }
      }
    }
  }

  return {
    nodeTransform,
    resolveTag,
    resolutions,
    resolutionKey,
    prunedBindings,
    getWrapper,
  }
}

interface TagCandidate {
  name: string
  lazy: boolean
  strategy?: Strategy
}

function parseTag (tag: string): TagCandidate[] {
  const suffix = STRATEGY_SUFFIX_RE.exec(tag)
  if (suffix) {
    const base = tag.slice(0, suffix.index)
    const lazy = LAZY_PREFIX_RE.exec(base)?.[0]
    return lazy ? [{ name: base.slice(lazy.length), lazy: true, strategy: suffix[1] as Strategy }] : []
  }

  const lazy = LAZY_PREFIX_RE.exec(tag)?.[0]
  if (!lazy) {
    return [{ name: tag, lazy: false }]
  }

  const name = tag.slice(lazy.length)
  const candidates: TagCandidate[] = [{ name, lazy: true }]
  const modifier = STRATEGY_PREFIX_RE.exec(name)
  if (modifier) {
    const strategy = (modifier[1] || pascalCase(modifier[2]!)) as Strategy
    candidates.push({ name: name.slice(modifier[0].length), lazy: true, strategy })
  }
  return candidates
}

function toRelativePath (path: string) {
  return RELATIVE_PATH_RE.test(path) ? path : `./${path}`
}

function getBaseName (tag: string) {
  return tag.replace(STRATEGY_SUFFIX_RE, '').replace(LAZY_PREFIX_RE, '')
}

const pascalNames = new Map<string, string>()
function toPascalName (name: string) {
  let pascalName = pascalNames.get(name)
  if (pascalName === undefined) {
    pascalName = pascalCase(name)
    pascalNames.set(name, pascalName)
  }
  return pascalName
}

function getPropName (prop: AttributeNode | DirectiveNode) {
  if (prop.type === NODE_ATTRIBUTE) {
    return prop.name
  }
  if (prop.name === 'bind' && prop.arg?.type === NODE_SIMPLE_EXPRESSION && prop.arg.isStatic) {
    return prop.arg.content
  }
}

function getVueIsTag (node: ElementNode) {
  for (const prop of node.props) {
    if (prop.type === NODE_ATTRIBUTE && prop.name === 'is' && prop.value?.content.startsWith('vue:')) {
      return prop.value.content.slice(4)
    }
  }
}

function isPlaceholderSlot (node: TemplateChildNode) {
  if (node.type !== NODE_ELEMENT || node.tagType !== ELEMENT_TEMPLATE) { return false }
  const slot = node.props.find((prop): prop is DirectiveNode => prop.type === NODE_DIRECTIVE && prop.name === 'slot')
  if (!slot?.arg || slot.arg.type !== NODE_SIMPLE_EXPRESSION) { return false }
  return !slot.arg.isStatic || PLACEHOLDER_SLOT_RE.test(slot.arg.content)
}

function getSetupReference (name: string, bindings: TransformContext['bindingMetadata']) {
  const camelName = camelize(name)
  for (const candidate of [name, camelName, capitalize(camelName)]) {
    if (SETUP_REFERENCE_TYPES.has(bindings[candidate] as string)) {
      return candidate
    }
  }
}

function getSetupBinding (tag: string, context: TransformContext) {
  const bindings = context.bindingMetadata
  if (!bindings || bindings.__isScriptSetup === false) { return }
  const dotIndex = tag.indexOf('.')
  return getSetupReference(dotIndex > 0 ? tag.slice(0, dotIndex) : tag, bindings)
}

function collectSetupBindings (node: TemplateChildNode, context: TransformContext, names: Set<string>) {
  if (node.type !== NODE_ELEMENT) { return }
  if (node.tagType === ELEMENT_COMPONENT) {
    const name = getSetupBinding(getVueIsTag(node) ?? node.tag, context)
    if (name) {
      names.add(name)
    }
  }
  for (const child of node.children) {
    collectSetupBindings(child, context, names)
  }
}

function toValidAssetId (name: string) {
  return `_component_${name.replace(/\W/g, (char, index: number) => char === '-' ? '_' : name.charCodeAt(index).toString())}`
}

function emitImport (context: TransformContext, assetId: string, resolution: ComponentImport) {
  const importName = IDENTIFIER_RE.test(resolution.importName) ? resolution.importName : JSON.stringify(resolution.importName)
  const exp: SimpleExpressionNode = {
    type: NODE_SIMPLE_EXPRESSION,
    content: resolution.importName === 'default' ? assetId : `{ ${importName} as ${assetId} }`,
    isStatic: false,
    constType: 0 as ConstantTypes.NOT_CONSTANT,
    loc: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 }, source: '' },
  }
  context.imports.push({ exp, path: resolution.source })
}

function removeResolveComponentHelper (context: TransformContext) {
  for (const helper of context.helpers.keys()) {
    if (context.helperString(helper) === '_resolveComponent') {
      context.helpers.delete(helper)
      return
    }
  }
}
