import { normalize, relative } from 'pathe'
import type { Compiler, Module, NormalModule } from 'webpack'
import { webpack } from '#builder'

export interface VueModuleIdentifierPluginOptions {
  rootDir?: string
}

export class VueModuleIdentifierPlugin {
  private rootDir?: string

  constructor (options: VueModuleIdentifierPluginOptions = {}) {
    this.rootDir = options.rootDir
  }

  apply (compiler: Compiler) {
    const pluginName = 'VueModuleIdentifierPlugin'
    const context = this.rootDir || compiler.options.context

    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      compilation.hooks.succeedModule.tap(pluginName, (module) => {
        const normalModule = toNormalModule(module)
        if (!normalModule || !isVueEntryModule(normalModule)) {
          return
        }

        const source = normalModule.originalSource()
        if (!source) {
          return
        }

        const resourcePath = normalModule.resource
        if (!resourcePath) {
          return
        }

        const relativePath = context ? relative(context, resourcePath) : resourcePath
        const moduleId = normalize(relativePath).replace(/^\.\//, '').replace(/\\/g, '/')

        // Only append when vue-loader left the __exports__ marker
        const code = source.source().toString()
        if (!code.includes('__exports__')) {
          return
        }

        normalModule._source = new webpack.sources.ConcatSource(source, `\n;__exports__.__moduleIdentifier = ${JSON.stringify(moduleId)};`)
      })
    })
  }
}

function toNormalModule (module: Module): NormalModule | undefined {
  return (module as NormalModule).resource ? module as NormalModule : undefined
}

function isVueEntryModule (module: NormalModule) {
  if (!module.resource) {
    return false
  }

  // Only tag the main Vue request (no block queries)
  const query = module.resourceResolveData?.query
  if (query && query !== '') {
    return false
  }

  return module.resource.endsWith('.vue')
}

declare module 'webpack' {
  interface NormalModule {
    _source?: sources.ConcatSource
  }
}
