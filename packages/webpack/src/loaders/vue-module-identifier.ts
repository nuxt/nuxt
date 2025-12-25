import type { LoaderDefinitionFunction } from 'webpack'
import { normalize, relative } from 'pathe'

interface LoaderOptions {
  isServer?: boolean
  rootDir?: string
}

const vueModuleIdentifierLoader: LoaderDefinitionFunction<LoaderOptions> = function (source) {
  this.cacheable?.()

  const { isServer, rootDir } = this.getOptions() || {}
  if (!isServer) {
    return source
  }

  const resourcePath = this.resourcePath || this._module?.resource
  if (!resourcePath || !source.includes('__exports__')) {
    return source
  }

  const context = rootDir || this.rootContext || this.context || this._compiler?.options?.context
  const relativePath = context ? relative(context, resourcePath) : resourcePath
  const normalizedPath = normalize(relativePath).replace(/^\.\//, '').replace(/\\/g, '/')
  const moduleId = normalizedPath || normalize(resourcePath).replace(/\\/g, '/').replace(/^\.\//, '')

  return `${source}\n;__exports__.__moduleIdentifier = ${JSON.stringify(moduleId)};`
}

export default vueModuleIdentifierLoader
