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
  const relativePath = context ? relative(context, resourcePath) : resourcePath
  const moduleId = normalize(relativePath).replace(/^\.\//, '').replace(/\\/g, '/')

  const snippet = `\n;__exports__.__moduleIdentifier = ${JSON.stringify(moduleId)};`
  return source + snippet
}

export default vueModuleIdentifierLoader
