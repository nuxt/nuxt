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
