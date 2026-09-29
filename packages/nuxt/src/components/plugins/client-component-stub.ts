import { createUnplugin } from 'unplugin'
import { dirname, isAbsolute, normalize, resolve } from 'pathe'
import escapeRE from 'escape-string-regexp'
import { resolveAlias } from '@nuxt/kit'
import type { Component } from '@nuxt/schema'
import { parseModuleId } from '../../core/utils/plugins.ts'

interface ClientComponentStubPluginOptions {
  getComponents (): Component[]
  serverPlaceholderPath: string
  alias: Record<string, string>
  dev: boolean
}

const NUXT_COMPONENT_QUERY_RE = /[?&]nuxt_component=/
const RELATIVE_RE = /^\.{1,2}\//
const EXTENSION_RE = /\.\w+$/
const CLIENT_SUFFIX_RE = /\.client(?:\.\w+)?(?:\?|$)/

function basename (id: string) {
  const query = id.indexOf('?')
  const end = query < 0 ? id.length : query
  let start = 0
  for (let i = end - 1; i >= 0; i--) {
    const char = id[i]
    if (char === '/' || char === '\\') {
      start = i + 1
      break
    }
  }
  return id.slice(start, end)
}

function isClientOnly (component: Component) {
  // a file registered in more than one mode (or exporting more than the component itself) still
  // has to be resolvable in the server build
  return !component._raw && component.mode === 'client' && (!component.export || component.export === 'default')
}

/**
 * Resolve direct imports of client-only component files to the server placeholder in the server
 * build. Components rendered through `#components` are already mapped to the placeholder, but a
 * component imported by path would otherwise be evaluated (and its side effects run) during SSR.
 */
export const ClientComponentStubPlugin = (options: ClientComponentStubPluginOptions) => createUnplugin(() => {
  let cachedComponents: Component[] | undefined
  let clientOnlyPaths = new Set<string>()
  // ids reaching the handler are still checked exactly, so this only has to be a cheap rejection
  let clientOnlyFileNames = new Set<string>()

  function syncComponents () {
    const components = options.getComponents()
    if (components === cachedComponents) { return }

    cachedComponents = components
    clientOnlyPaths = new Set()
    clientOnlyFileNames = new Set()
    const nonClientPaths = new Set<string>()

    for (const component of components) {
      const filePath = normalize(component.filePath)
      if (!isClientOnly(component)) {
        nonClientPaths.add(filePath)
        continue
      }
      clientOnlyPaths.add(filePath)
      clientOnlyPaths.add(filePath.replace(EXTENSION_RE, ''))
    }

    for (const path of nonClientPaths) {
      clientOnlyPaths.delete(path)
      clientOnlyPaths.delete(path.replace(EXTENSION_RE, ''))
    }

    for (const path of clientOnlyPaths) {
      clientOnlyFileNames.add(basename(path))
    }
  }

  function handler (id: string, importer: string | undefined) {
    syncComponents()

    if (!clientOnlyFileNames.has(basename(id)) || NUXT_COMPONENT_QUERY_RE.test(id)) { return }

    const { pathname } = parseModuleId(id)
    if (!pathname) { return }

    const aliased = resolveAlias(pathname, options.alias)
    const path = isAbsolute(aliased)
      ? normalize(aliased)
      : RELATIVE_RE.test(aliased) && importer
        ? resolve(dirname(parseModuleId(importer).pathname || importer), aliased)
        : undefined

    if (!path || !clientOnlyPaths.has(path)) { return }

    return options.serverPlaceholderPath
  }

  return {
    name: 'nuxt:components:client-component-stub',
    enforce: 'pre',
    // A hook filter is resolved once, so it can only be used where the set of components is final.
    // In dev a module can still register a component at an arbitrary path on a later scan, and the
    // handler's own check is what keeps up with that.
    resolveId: options.dev
      ? handler
      : {
          // otherwise every resolution in the server build reaches the handler
          filter: { id: { include: [CLIENT_SUFFIX_RE, ...unconventionalClientPaths(options.getComponents())] } },
          handler,
        },
  }
})

/**
 * Client components are conventionally suffixed with `.client`, which a filter can match directly,
 * but a module can register one at any path, so those have to be listed.
 */
function unconventionalClientPaths (components: Component[]) {
  const paths: RegExp[] = []
  for (const component of components) {
    if (isClientOnly(component) && !CLIENT_SUFFIX_RE.test(component.filePath)) {
      paths.push(new RegExp(escapeRE(normalize(component.filePath).replace(EXTENSION_RE, ''))))
    }
  }
  return paths
}
