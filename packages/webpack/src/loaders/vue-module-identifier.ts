import type { LoaderDefinitionFunction } from 'webpack'
import { normalize, relative } from 'pathe'

interface LoaderOptions {
  srcDir?: string
}

const vueModuleIdentifierLoader: LoaderDefinitionFunction<LoaderOptions> = function (source) {
  this.cacheable?.()

  const { srcDir } = this.getOptions() || {}

  const resourcePath = this.resourcePath || this._module?.resource
  if (!resourcePath || !source.includes('__exports__')) {
    return source
  }

  const context = srcDir || this.rootContext || this.context || this._compiler?.options?.context
  return appendModuleIdentifier(source, context ? getModuleIdentifier(resourcePath, context) : normalizeModuleIdentifier(resourcePath))
}

/** Identifier of a module in the client manifest, relative to `context`. */
export function getModuleIdentifier (resourcePath: string, context: string): string {
  return normalizeModuleIdentifier(relative(context, resourcePath))
}

function normalizeModuleIdentifier (path: string) {
  return normalize(path).replace(/^\.\//, '').replace(/\\/g, '/')
}

/**
 * Append code to a compiled Vue SFC that adds `moduleId` to `ssrContext.modules` when the component is set up.
 */
export function appendModuleIdentifier (source: string, moduleId: string): string {
  return source + [
    '',
    'import { useSSRContext as __nuxt_useSSRContext } from \'vue\'',
    'const __nuxt_setup = __exports__.setup',
    '__exports__.setup = (props, ctx) => {',
    '  const ssrContext = __nuxt_useSSRContext()',
    `  ;(ssrContext.modules ||= new Set()).add(${JSON.stringify(moduleId)})`,
    '  return __nuxt_setup ? __nuxt_setup(props, ctx) : undefined',
    '}',
  ].join('\n')
}

export default vueModuleIdentifierLoader
