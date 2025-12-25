import { normalize, relative } from 'pathe'
import type { Compiler, Dependency, Module, NormalModule } from 'webpack'
import { webpack } from '#builder'

export interface VueModuleIdentifierPluginOptions {
  srcDir?: string
}

export class VueModuleIdentifierPlugin {
  private srcDir?: string

  constructor (options: VueModuleIdentifierPluginOptions = {}) {
    this.srcDir = options.srcDir
  }

  apply (compiler: Compiler) {
    const pluginName = 'VueModuleIdentifierPlugin'
    const context = this.srcDir || compiler.options.context

    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      compilation.dependencyTemplates.set(ModuleIdentifierDependency, new ModuleIdentifierDependencyTemplate())

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

        if (hasModuleIdentifierDependency(normalModule)) {
          return
        }

        normalModule.addDependency(new ModuleIdentifierDependency(moduleId))
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

class ModuleIdentifierDependency extends (webpack.Dependency as { new(): Dependency }) {
  moduleId: string

  constructor (moduleId: string) {
    super()
    this.moduleId = moduleId
  }

  override get type () {
    return 'nuxt module identifier'
  }
}

type ReplaceSource = InstanceType<typeof webpack.sources.ReplaceSource>

class ModuleIdentifierDependencyTemplate {
  apply (dep: Dependency, source: ReplaceSource) {
    const identifier = (dep as ModuleIdentifierDependency).moduleId
    const snippet = `\n;__exports__.__moduleIdentifier = ${JSON.stringify(identifier)};`
    source.insert(source.size(), snippet)
  }
}

function hasModuleIdentifierDependency (module: NormalModule) {
  return module.dependencies?.some(dep => dep instanceof ModuleIdentifierDependency)
}
